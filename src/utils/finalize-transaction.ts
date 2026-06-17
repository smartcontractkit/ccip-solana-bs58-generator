import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { TransactionBuilder } from '../core/transaction-builder.js';
import type { CommandContext } from '../types/command.js';
import type { GeneratedTransaction } from '../types/index.js';
import { TransactionDisplay } from './display.js';
import { executeTransaction } from './transaction-executor.js';
import { loadSignerKeypair } from './keypair.js';
import { resolveClusterByGenesisHash } from './explorer.js';
import type { SolanaEnvironment } from './constants.js';
import { DEFAULT_TRANSACTION_OUTPUT_FORMAT, parseTransactionOutputFormat } from './constants.js';

function getGlobalOptions(command: CommandContext) {
  return command.parent?.parent?.opts() || command.parent?.opts() || {};
}

/**
 * Build and either display encoded transaction data or execute on-chain with a local keypair.
 */
export async function finalizeTransaction(opts: {
  txBuilder: TransactionBuilder;
  instructions: TransactionInstruction[];
  payer: PublicKey;
  instructionName: string;
  command: CommandContext;
}): Promise<GeneratedTransaction> {
  const { txBuilder, instructions, payer, instructionName, command } = opts;
  const globalOptions = getGlobalOptions(command);

  const tx = await txBuilder.buildTransaction(instructions, payer, instructionName);

  const outputFormat =
    parseTransactionOutputFormat(globalOptions.format) ?? DEFAULT_TRANSACTION_OUTPUT_FORMAT;

  if (!globalOptions.execute) {
    TransactionDisplay.displayResults(tx, instructionName, outputFormat);
    return tx;
  }

  const keypair = loadSignerKeypair(globalOptions);

  if (!keypair.publicKey.equals(payer)) {
    throw new Error(
      'Keypair does not match --authority; EOA execution requires your keypair to be the transaction fee payer and signer.'
    );
  }

  if (tx.metadata.simulationSuccess === false) {
    const simError = tx.metadata.simulationError ? `: ${tx.metadata.simulationError}` : '';
    throw new Error(`Transaction simulation failed${simError}`);
  }

  // Verify the local keypair can satisfy ALL required signatures before announcing/sending.
  // The build-time simulation above runs unsigned (sigVerify:false) for the Squads path, so it
  // cannot catch a transaction that still requires a signature we don't hold. Re-simulate the signed
  // transaction with sigVerify enabled to fail fast on that case.
  const signedSim = await txBuilder.simulateSignedTransaction(instructions, payer, keypair);
  if (!signedSim.success) {
    throw new Error(
      'Signature verification failed in simulation. In --execute mode only your keypair signs, but ' +
        'this transaction still requires another signature. For an SPL multisig, pass only key(s) ' +
        'you hold in --multisig-signers (a 1-of-N multisig needs just your own member key); if the ' +
        "threshold requires co-signers you don't control, it can't be executed locally — use Squads " +
        `mode (omit --execute). Details: ${signedSim.error}`
    );
  }

  const rpcUrl = globalOptions.resolvedRpcUrl!;
  const connection = new Connection(rpcUrl);

  // Resolve the cluster authoritatively from the chain's genesis hash when --env was not given, so
  // both the mainnet warning and the explorer link are correct even with --rpc-url. Never throw here.
  let env = globalOptions.environment as SolanaEnvironment | undefined;
  if (!env) {
    try {
      env = await resolveClusterByGenesisHash(connection);
    } catch {
      // leave undefined — a missing cluster only degrades the explorer link, not execution
    }
  }

  TransactionDisplay.displayExecutionBanner({
    signer: keypair.publicKey.toBase58(),
    instructionName,
    env,
    rpcUrl,
  });

  const signature = await executeTransaction(connection, instructions, [keypair]);

  TransactionDisplay.displayExecutionResults(signature, instructionName, env);
  return tx;
}
