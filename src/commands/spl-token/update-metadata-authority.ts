import { Command } from 'commander';
import { Connection, TransactionInstruction } from '@solana/web3.js';
import { validateArgs } from '../../utils/validation.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { TransactionDisplay } from '../../utils/display.js';
import { detectTokenProgramId } from '../../utils/token.js';
import { InstructionBuilder as SplInstructionBuilder } from '../../programs/spl-token/instructions.js';
import { SplUpdateMetadataAuthorityArgsSchema } from '../../types/index.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { logger } from '../../utils/logger.js';

export async function updateMetadataAuthorityCommand(
  options: Record<string, string>,
  command: Command
) {
  try {
    const global = command.parent?.opts() || {};
    const parsed = validateArgs(SplUpdateMetadataAuthorityArgsSchema, {
      authority: options.authority,
      mint: options.mint,
      metadataAccount: options.metadataAccount,
      newAuthority: options.newAuthority,
      rpcUrl: global.resolvedRpcUrl,
    });
    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      process.exit(1);
    }
    const rpcUrl = parsed.data.rpcUrl ?? (global.resolvedRpcUrl as string);

    const connection = new Connection(rpcUrl);
    const programId = await detectTokenProgramId(connection, parsed.data.mint);
    if (!programId.equals(TOKEN_2022_PROGRAM_ID)) {
      console.error('❌ update-metadata-authority is only supported for Token-2022 mints');
      process.exit(1);
    }

    const builder = new SplInstructionBuilder(programId);
    const metadataAccount = parsed.data.metadataAccount ?? parsed.data.mint;
    const ixs: TransactionInstruction[] = [
      builder.updateMetadataAuthority(
        metadataAccount,
        parsed.data.authority,
        parsed.data.newAuthority ?? null
      ),
    ];

    const tb = new TransactionBuilder({ rpcUrl });
    logger.info('🔄 Building and simulating transaction...');
    const tx = await tb.buildTransaction(
      ixs,
      parsed.data.authority,
      'spl.update_metadata_authority'
    );
    logger.info('✅ Transaction simulation completed');
    TransactionDisplay.displayResults(tx, 'spl.update_metadata_authority');
  } catch (error) {
    logger.error('❌ Failed to update metadata authority');
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    console.error('❌ Failed to update metadata authority.');
    console.error('💡 Check your parameters, mint address, and Token-2022 configuration.');
    process.exit(1);
  }
}
