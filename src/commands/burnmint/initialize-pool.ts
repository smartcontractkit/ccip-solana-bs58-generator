import type { TransactionOptions } from '../../types/index.js';
import { BurnmintInitializePoolArgsSchema } from '../../types/index.js';
import { validateArgs, validateRpcConnectivity } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { TransactionDisplay } from '../../utils/display.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { InstructionBuilder } from '../../programs/burnmint-token-pool/instructions.js';
import { getProgramConfig } from '../../types/program-registry.js';

export async function initializePoolCommand(
  options: { programId: string; mint: string; authority: string },
  command: {
    parent?: {
      parent?: { opts(): { resolvedRpcUrl?: string } };
      opts(): { resolvedRpcUrl?: string };
    };
  }
): Promise<void> {
  const cmdLogger = createChildLogger(logger, { command: 'burnmint.initialize-pool' });
  try {
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};
    const programConfig = getProgramConfig('burnmint-token-pool');
    if (!programConfig?.idl) {
      console.error('❌ Burnmint Token Pool IDL not available');
      process.exit(1);
    }

    const parsed = validateArgs(BurnmintInitializePoolArgsSchema, {
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
    console.log('🔗 Validating RPC connectivity...');
    const ok = await validateRpcConnectivity(rpc);
    if (!ok) {
      console.error(`❌ Cannot connect to RPC endpoint: ${rpc}`);
      process.exit(1);
    }
    console.log('   ✅ RPC connection verified');

    const txOptions: TransactionOptions = { rpcUrl: rpc };
    const txBuilder = new TransactionBuilder(txOptions);
    const ib = new InstructionBuilder(programId, programConfig.idl);

    console.log('🔄 Generating initialize (pool) transaction...');
    const ix = await ib.initialize(mint, authority);

    console.log('🔄 Building and simulating transaction...');
    const tx = await txBuilder.buildSingleInstructionTransaction(
      ix,
      authority,
      'burnmint.initialize'
    );
    console.log('   ✅ Transaction simulation completed');

    TransactionDisplay.displayResults(tx, 'burnmint.initialize');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: message }, 'initializePool failed');
    if (error instanceof Error && error.stack) {
      cmdLogger.error({ stack: error.stack }, 'Stack trace');
    }
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}
