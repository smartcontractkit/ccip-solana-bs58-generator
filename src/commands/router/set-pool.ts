import type { TransactionOptions } from '../../types/index.js';
import { RouterSetPoolArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { TransactionDisplay } from '../../utils/display.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { InstructionBuilder } from '../../programs/router/instructions.js';
import { getProgramConfig } from '../../types/program-registry.js';
// no extra address utils needed for writable indexes

export async function setPoolCommand(
  options: {
    programId: string;
    mint: string;
    authority: string;
    poolLookupTable: string;
    writableIndexes: string; // json array of numbers
  },
  command: {
    parent?: {
      parent?: { opts(): { resolvedRpcUrl?: string } };
      opts(): { resolvedRpcUrl?: string };
    };
  }
): Promise<void> {
  const cmdLogger = createChildLogger(logger, { command: 'router.set-pool' });
  try {
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};
    const programConfig = getProgramConfig('router');
    if (!programConfig?.idl) {
      console.error('❌ Router IDL not available');
      process.exit(1);
    }

    const args = {
      programId: options.programId,
      mint: options.mint,
      authority: options.authority,
      poolLookupTable: options.poolLookupTable,
      writableIndexes: options.writableIndexes,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    };
    const parsed = validateArgs(RouterSetPoolArgsSchema, args);
    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      process.exit(1);
    }
    const { programId, mint, authority, poolLookupTable, writableIndexes, rpcUrl } = parsed.data;
    const rpc = rpcUrl ?? (globalOptions.resolvedRpcUrl as string);

    const transactionOptions: TransactionOptions = { rpcUrl: rpc };
    const transactionBuilder = new TransactionBuilder(transactionOptions);
    const instructionBuilder = new InstructionBuilder(programId, programConfig.idl);

    // Validate and log indices, then pass as Vec<u8>
    if (writableIndexes.some(i => i < 0 || i > 255 || !Number.isInteger(i))) {
      throw new Error('Writable indexes must be integers between 0 and 255');
    }
    cmdLogger.debug({ indices: writableIndexes }, 'Writable indexes to set (Vec<u8>)');

    console.log('🔄 Generating set_pool transaction...');
    const instruction = await instructionBuilder.setPool(
      mint,
      poolLookupTable,
      authority,
      writableIndexes
    );

    console.log('🔄 Building and simulating transaction...');
    const tx = await transactionBuilder.buildSingleInstructionTransaction(
      instruction,
      authority,
      'router.set_pool'
    );
    console.log('   ✅ Transaction simulation completed');

    TransactionDisplay.displayResults(tx, 'router.set_pool');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: message }, 'setPool failed');
    if (error instanceof Error && error.stack) {
      cmdLogger.error({ stack: error.stack }, 'Stack trace');
    }
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}
