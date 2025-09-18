import type { TransactionOptions } from '../../types/index.js';
import { RouterTransferAdminRoleArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { TransactionDisplay } from '../../utils/display.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { InstructionBuilder } from '../../programs/router/instructions.js';
import { getProgramConfig } from '../../types/program-registry.js';

export async function transferAdminRoleCommand(
  options: {
    programId: string;
    mint: string;
    authority: string;
    newAdmin: string;
  },
  command: {
    parent?: {
      parent?: { opts(): { resolvedRpcUrl?: string } };
      opts(): { resolvedRpcUrl?: string };
    };
  }
): Promise<void> {
  const cmdLogger = createChildLogger(logger, { command: 'router.transfer-admin-role' });
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
      newAdmin: options.newAdmin,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    };
    const parsed = validateArgs(RouterTransferAdminRoleArgsSchema, args);
    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      process.exit(1);
    }
    const { programId, mint, authority, newAdmin, rpcUrl } = parsed.data;
    const rpc = rpcUrl ?? (globalOptions.resolvedRpcUrl as string);

    const transactionOptions: TransactionOptions = { rpcUrl: rpc };
    const transactionBuilder = new TransactionBuilder(transactionOptions);
    const instructionBuilder = new InstructionBuilder(programId, programConfig.idl);

    console.log('🔄 Generating transfer_admin_role_token_admin_registry transaction...');
    const instruction = await instructionBuilder.transferAdminRoleTokenAdminRegistry(
      mint,
      authority,
      newAdmin
    );

    console.log('🔄 Building and simulating transaction...');
    const tx = await transactionBuilder.buildSingleInstructionTransaction(
      instruction,
      authority!,
      'router.transfer_admin_role_token_admin_registry'
    );
    console.log('   ✅ Transaction simulation completed');

    TransactionDisplay.displayResults(tx, 'router.transfer_admin_role_token_admin_registry');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: message }, 'transferAdminRole failed');
    if (error instanceof Error && error.stack) {
      cmdLogger.error({ stack: error.stack }, 'Stack trace');
    }
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}
