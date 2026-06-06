import { Command } from 'commander';
import { Connection, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { finalizeTransaction } from '../../utils/finalize-transaction.js';
import { validateArgs } from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';
import { InstructionBuilder as SplInstructionBuilder } from '../../programs/spl-token/instructions.js';
import { SplCreateMultisigArgsSchema } from '../../types/index.js';
import { detectTokenProgramId } from '../../utils/token.js';

export async function createSplMultisigCommand(options: Record<string, string>, command: Command) {
  try {
    const global = command.parent?.opts() || {};
    const rpcUrl = global.resolvedRpcUrl as string;

    const connection = new Connection(rpcUrl);
    const parsed = validateArgs(SplCreateMultisigArgsSchema, {
      authority: options.authority,
      signers: options.signers,
      threshold: options.threshold,
      seed: options.seed,
      mint: options.mint,
      rpcUrl,
    });
    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      process.exit(1);
    }
    const authority = parsed.data.authority;
    const seed = parsed.data.seed;
    const signerPubkeys = parsed.data.signers;
    const threshold = parsed.data.threshold;
    const mint = parsed.data.mint;

    // Detect correct token program from the provided mint
    const detectedProgram = await detectTokenProgramId(connection, mint);
    const tokenProgramId = detectedProgram.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;

    // Create multisig account with seed (deterministic, no new signer required)
    const space = 355; // multisig account size
    const lamports = await connection.getMinimumBalanceForRentExemption(space);

    const builder = new SplInstructionBuilder(tokenProgramId);
    const { address: multisigAddress, instructions } = await builder.createMultisigWithSeed(
      authority,
      authority,
      seed,
      mint,
      signerPubkeys,
      threshold,
      space,
      lamports
    );

    const ixs: TransactionInstruction[] = instructions;
    const tb = new TransactionBuilder({ rpcUrl });
    logger.info('🔄 Building and simulating transaction...');
    console.log(`📮 Derived SPL Token Multisig Address: ${multisigAddress.toBase58()}`);
    console.log(
      `💡 Address derived from: authority + sha256("${seed}" + mint).hex().slice(0,32) + tokenProgram`
    );
    await finalizeTransaction({
      txBuilder: tb,
      instructions: ixs,
      payer: authority,
      instructionName: 'spl.create_multisig',
      command,
    });
    logger.info('✅ Transaction simulation completed');
  } catch (error) {
    logger.error('❌ Failed to create SPL Token multisig');
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    console.error('❌ Failed to create SPL Token multisig.');
    console.error('💡 Check your parameters, signer configuration, and RPC connection.');
    process.exit(1);
  }
}
