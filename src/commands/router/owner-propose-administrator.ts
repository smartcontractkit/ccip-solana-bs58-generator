import type { TransactionOptions } from '../../types/index.js';
import { RouterOwnerProposeAdministratorArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { TransactionDisplay } from '../../utils/display.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { InstructionBuilder } from '../../programs/router/instructions.js';
import { getProgramConfig } from '../../types/program-registry.js';

export async function ownerProposeAdministratorCommand(
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
  const cmdLogger = createChildLogger(logger, { command: 'router.owner-propose-administrator' });
  try {
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};
    const programConfig = getProgramConfig('router');
    if (!programConfig?.idl) {
      console.error('❌ Router IDL not available');
      process.exit(1);
    }

    // Validate and parse args
    const args = {
      programId: options.programId,
      mint: options.mint,
      authority: options.authority,
      tokenAdminRegistryAdmin: options.tokenAdminRegistryAdmin,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    };
    const parsed = validateArgs(RouterOwnerProposeAdministratorArgsSchema, args);
    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      process.exit(1);
    }
    const { programId, mint, authority, tokenAdminRegistryAdmin, rpcUrl } = parsed.data;
    const rpc = rpcUrl ?? (globalOptions.resolvedRpcUrl as string);

    const transactionOptions: TransactionOptions = { rpcUrl: rpc };
    const transactionBuilder = new TransactionBuilder(transactionOptions);
    const instructionBuilder = new InstructionBuilder(programId, programConfig.idl);

    console.log('🔄 Generating owner_propose_administrator transaction...');
    const instruction = await instructionBuilder.ownerProposeAdministrator(
      mint,
      authority,
      tokenAdminRegistryAdmin
    );

    console.log('🔄 Building and simulating transaction...');
    const tx = await transactionBuilder.buildSingleInstructionTransaction(
      instruction,
      authority!,
      'router.owner_propose_administrator'
    );
    console.log('   ✅ Transaction simulation completed');

    TransactionDisplay.displayResults(tx, 'router.owner_propose_administrator');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: message }, 'ownerProposeAdministrator failed');
    if (error instanceof Error && error.stack) {
      cmdLogger.error({ stack: error.stack }, 'Stack trace');
    }
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}
