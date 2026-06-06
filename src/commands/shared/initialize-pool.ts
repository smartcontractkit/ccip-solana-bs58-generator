import type { TransactionOptions } from '../../types/index.js';
import { BaseInitializePoolArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { finalizeTransaction } from '../../utils/finalize-transaction.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { getProgramConfig, type ProgramName } from '../../types/program-registry.js';
import type { CommandContext, InitializePoolOptions } from '../../types/command.js';
import { InstructionBuilder as BurnmintInstructionBuilder } from '../../programs/burnmint-token-pool/instructions.js';
import { InstructionBuilder as LockreleaseInstructionBuilder } from '../../programs/lockrelease-token-pool/instructions.js';

/**
 * Shared initialize pool implementation
 */
export async function initializePool(
  options: InitializePoolOptions,
  command: CommandContext,
  programType: ProgramName
): Promise<void> {
  const cmdLogger = createChildLogger(logger, { command: `${programType}.initialize-pool` });

  try {
    // Get global options and program config
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};
    const programConfig = getProgramConfig(programType);

    if (!programConfig?.idl) {
      console.error(`❌ ${programConfig.displayName} IDL not available`);
      process.exit(1);
    }

    // Validate arguments (this handles the PublicKey conversion)
    const parsed = validateArgs(BaseInitializePoolArgsSchema, {
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

    // Validate RPC connectivity
    const rpc = rpcUrl ?? (globalOptions.resolvedRpcUrl as string);

    // Build transaction
    const txOptions: TransactionOptions = { rpcUrl: rpc };
    const txBuilder = new TransactionBuilder(txOptions);

    console.log('🔄 Generating initialize (pool) transaction...');

    // Create the appropriate instruction builder based on program type
    let ix;
    if (programType === 'burnmint-token-pool') {
      const builder = new BurnmintInstructionBuilder(programId, programConfig.idl);
      ix = await builder.initialize(mint, authority);
    } else if (programType === 'lockrelease-token-pool') {
      const builder = new LockreleaseInstructionBuilder(programId, programConfig.idl);
      ix = await builder.initialize(mint, authority);
    } else {
      throw new Error(`Unsupported program type: ${programType}`);
    }

    console.log('🔄 Building and simulating transaction...');
    await finalizeTransaction({
      txBuilder,
      instructions: [ix],
      payer: authority,
      instructionName: `${programType}.initialize`,
      command,
    });
    console.log('   ✅ Transaction simulation completed');
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
