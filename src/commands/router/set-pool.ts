import type { TransactionOptions } from '../../types/index.js';
import { RouterSetPoolArgsSchema } from '../../types/index.js';
import { validateArgs, validateRpcConnectivity } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { TransactionDisplay } from '../../utils/display.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { InstructionBuilder } from '../../programs/router/instructions.js';
import { getProgramConfig } from '../../types/program-registry.js';
import { hexToBytes, normalizeHexString } from '../../utils/addresses.js';

export async function setPoolCommand(
  options: {
    programId: string;
    mint: string;
    authority: string;
    poolLookupTable: string;
    writableIndexes: string; // hex
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
    console.log('🔗 Validating RPC connectivity...');
    const isConnected = await validateRpcConnectivity(rpc);
    if (!isConnected) {
      console.error(`❌ Cannot connect to RPC endpoint: ${rpcUrl}`);
      process.exit(1);
    }
    console.log('   ✅ RPC connection verified');

    const transactionOptions: TransactionOptions = { rpcUrl: rpc };
    const transactionBuilder = new TransactionBuilder(transactionOptions);
    const instructionBuilder = new InstructionBuilder(programId, programConfig.idl);

    const norm = normalizeHexString(writableIndexes);
    const writableIndexesBitmap = hexToBytes(norm);

    console.log('🔄 Generating set_pool transaction...');
    const instruction = await instructionBuilder.setPool(
      mint,
      poolLookupTable,
      authority,
      writableIndexesBitmap
    );

    console.log('🔄 Building and simulating transaction...');
    const tx = await transactionBuilder.buildSingleInstructionTransaction(
      instruction,
      authority!,
      'router.set_pool'
    );
    console.log('   ✅ Transaction simulation completed');

    TransactionDisplay.displayResults(tx, 'router.set_pool');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: message }, 'setPool failed');
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}
