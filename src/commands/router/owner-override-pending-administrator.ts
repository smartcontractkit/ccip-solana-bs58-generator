import type { TransactionOptions } from '../../types/index.js';
import { RouterOwnerOverridePendingAdministratorArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { finalizeTransaction } from '../../utils/finalize-transaction.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { InstructionBuilder } from '../../programs/router/instructions.js';
import { getProgramConfig } from '../../types/program-registry.js';

export async function ownerOverridePendingAdministratorCommand(
  options: {
    programId: string;
    mint: string;
    authority: string;
    tokenAdminRegistryAdmin: string;
  },
  command: {
    parent?: {
      parent?: { opts(): { resolvedRpcUrl?: string } };
      opts(): { resolvedRpcUrl?: string };
    };
  }
): Promise<void> {
  const cmdLogger = createChildLogger(logger, {
    command: 'router.owner-override-pending-administrator',
  });
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
      tokenAdminRegistryAdmin: options.tokenAdminRegistryAdmin,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    };
    const parsed = validateArgs(RouterOwnerOverridePendingAdministratorArgsSchema, args);
    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      process.exit(1);
    }
    const { programId, mint, authority, tokenAdminRegistryAdmin, rpcUrl } = parsed.data;
    const rpc = rpcUrl ?? (globalOptions.resolvedRpcUrl as string);

    const transactionOptions: TransactionOptions = { rpcUrl: rpc };
    const transactionBuilder = new TransactionBuilder(transactionOptions);
    const instructionBuilder = new InstructionBuilder(programId, programConfig.idl);

    console.log('🔄 Generating owner_override_pending_administrator transaction...');
    const instruction = await instructionBuilder.ownerOverridePendingAdministrator(
      mint,
      authority,
      tokenAdminRegistryAdmin
    );

    console.log('🔄 Building and simulating transaction...');
    await finalizeTransaction({
      txBuilder: transactionBuilder,
      instructions: [instruction],
      payer: authority!,
      instructionName: 'router.owner_override_pending_administrator',
      command,
    });
    console.log('   ✅ Transaction simulation completed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: message }, 'ownerOverridePendingAdministrator failed');
    if (error instanceof Error && error.stack) {
      cmdLogger.error({ stack: error.stack }, 'Stack trace');
    }
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}
