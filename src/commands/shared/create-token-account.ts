import { Connection } from '@solana/web3.js';
import type { TransactionOptions } from '../../types/index.js';
import { CreateTokenAccountArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { finalizeTransaction } from '../../utils/finalize-transaction.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { type ProgramName } from '../../types/program-registry.js';
import type { CommandContext, CreateTokenAccountOptions } from '../../types/command.js';
import { detectTokenProgramId, findAssociatedTokenAddress } from '../../utils/token.js';
import { InstructionBuilder as SplInstructionBuilder } from '../../programs/spl-token/instructions.js';
import { AccountDerivation as BurnmintDerivation } from '../../programs/burnmint-token-pool/accounts.js';
import { AccountDerivation as LockreleaseDerivation } from '../../programs/lockrelease-token-pool/accounts.js';

/**
 * Shared implementation: create the pool signer's Associated Token Account (the pool's token
 * reserve account). Works for both SPL Token and Token-2022 (program auto-detected from the mint),
 * and supports both Base58 (Squads) output and --execute. Idempotent: safe to re-run.
 */
export async function createTokenAccount(
  options: CreateTokenAccountOptions,
  command: CommandContext,
  programType: ProgramName
): Promise<void> {
  const cmdLogger = createChildLogger(logger, { command: `${programType}.create-token-account` });

  try {
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};

    const parsed = validateArgs(CreateTokenAccountArgsSchema, {
      programId: options.programId,
      mint: options.mint,
      authority: options.authority,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    });

    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      process.exit(1);
    }

    const { programId, mint, authority, rpcUrl } = parsed.data;
    const rpc = rpcUrl ?? (globalOptions.resolvedRpcUrl as string);

    // Detect SPL Token vs Token-2022 from the mint
    const connection = new Connection(rpc);
    const tokenProgramId = await detectTokenProgramId(connection, mint);

    // Owner of the ATA is the pool signer PDA (program-specific)
    const [poolSigner] =
      programType === 'burnmint-token-pool'
        ? BurnmintDerivation.derivePoolSignerPda(programId, mint)
        : LockreleaseDerivation.derivePoolSignerPda(programId, mint);

    const ata = findAssociatedTokenAddress(mint, poolSigner, tokenProgramId);

    const builder = new SplInstructionBuilder(tokenProgramId);
    const ix = builder.createAssociatedTokenAccountIdempotentWithAddress(
      authority,
      ata,
      poolSigner,
      mint
    );

    console.log('🔄 Generating create pool token account transaction...');
    console.log(`   Token Program:            ${tokenProgramId.toBase58()}`);
    console.log(`   Pool Signer (ATA owner):  ${poolSigner.toBase58()}`);
    console.log(`   Pool Token Account (ATA): ${ata.toBase58()}`);

    const txOptions: TransactionOptions = { rpcUrl: rpc };
    const txBuilder = new TransactionBuilder(txOptions);

    console.log('🔄 Building and simulating transaction...');
    await finalizeTransaction({
      txBuilder,
      instructions: [ix],
      payer: authority,
      instructionName: `${programType}.create-token-account`,
      command,
    });
    console.log('   ✅ Transaction simulation completed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: message }, 'createTokenAccount failed');
    if (error instanceof Error && error.stack) {
      cmdLogger.error({ stack: error.stack }, 'Stack trace');
    }
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}
