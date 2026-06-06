import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { TransactionBuilder } from '../core/transaction-builder.js';
import type { CommandContext } from '../types/command.js';
import type { GeneratedTransaction } from '../types/index.js';
import { TransactionDisplay } from './display.js';
import { loadKeypair, executeTransaction } from './transaction-executor.js';
import type { SolanaEnvironment } from './constants.js';

function getGlobalOptions(command: CommandContext) {
  return command.parent?.parent?.opts() || command.parent?.opts() || {};
}

function expandHomePath(path: string): string {
  if (path.startsWith('~/')) {
    return `${process.env.HOME || process.env.USERPROFILE || ''}/${path.slice(2)}`;
  }
  return path;
}

/**
 * Build and either display Base58 transaction data or execute on-chain with a local keypair.
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

  if (!globalOptions.execute) {
    TransactionDisplay.displayResults(tx, instructionName);
    return tx;
  }

  const keypairPath = expandHomePath(globalOptions.keypair!);
  const keypair = loadKeypair(keypairPath);

  if (!keypair.publicKey.equals(payer)) {
    throw new Error(
      'Keypair does not match --authority; EOA execution requires your keypair to be the transaction fee payer and signer.'
    );
  }

  if (tx.metadata.simulationSuccess === false) {
    const simError = tx.metadata.simulationError ? `: ${tx.metadata.simulationError}` : '';
    throw new Error(`Transaction simulation failed${simError}`);
  }

  const rpcUrl = globalOptions.resolvedRpcUrl!;
  const connection = new Connection(rpcUrl);
  const signature = await executeTransaction(connection, instructions, [keypair]);

  const env = globalOptions.environment as SolanaEnvironment | undefined;
  TransactionDisplay.displayExecutionResults(signature, instructionName, env);
  return tx;
}
