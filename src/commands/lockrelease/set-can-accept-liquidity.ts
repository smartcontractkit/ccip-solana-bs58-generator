import type { TransactionOptions } from '../../types/index.js';
import { SetCanAcceptLiquidityArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { finalizeTransaction } from '../../utils/finalize-transaction.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { getProgramConfig } from '../../types/program-registry.js';
import type { CommandContext, SetCanAcceptLiquidityOptions } from '../../types/command.js';
import { InstructionBuilder } from '../../programs/lockrelease-token-pool/instructions.js';

/**
 * Set can accept liquidity command for lockrelease token pool
 */
export async function setCanAcceptLiquidityCommand(
  options: SetCanAcceptLiquidityOptions,
  command: CommandContext
): Promise<void> {
  const cmdLogger = createChildLogger(logger, {
    command: 'lockrelease.set-can-accept-liquidity',
  });

  try {
    // Get global options from parent command
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};

    // Log command start
    cmdLogger.info(
      {
        programId: options.programId,
        mint: options.mint,
        authority: options.authority,
        allow: options.allow,
        globalOptions,
      },
      'Starting setCanAcceptLiquidity command'
    );

    // Parse and validate arguments
    const args = {
      programId: options.programId,
      mint: options.mint,
      authority: options.authority,
      allow: options.allow,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    };

    const validation = validateArgs(SetCanAcceptLiquidityArgsSchema, args);
    if (!validation.success) {
      const errorMessage = `Invalid arguments: ${validation.errors.join(', ')}`;
      cmdLogger.error(errorMessage);
      console.error(`❌ ${errorMessage}`);
      console.error('💡 Expected format:');
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • Authority: Base58 public key (44 characters, must be pool owner)');
      console.error('   • Allow: Boolean (true/false)');
      console.error('   • RPC URL: Valid HTTP/HTTPS URL');
      process.exit(1);
    }

    const validatedArgs = validation.data;
    const rpcUrl = validatedArgs.rpcUrl || globalOptions.resolvedRpcUrl!;

    // Load IDL and validate instruction exists
    cmdLogger.debug('Loading IDL and validating instruction');
    const programConfig = getProgramConfig('lockrelease-token-pool');
    if (!programConfig?.idl) {
      const errorMessage = 'Lockrelease token pool IDL not available';
      cmdLogger.error(errorMessage);
      console.error(`❌ ${errorMessage}`);
      process.exit(1);
    }

    // Create transaction builder
    const transactionOptions: TransactionOptions = {
      rpcUrl,
    };

    const transactionBuilder = new TransactionBuilder(transactionOptions);

    // Create instruction builder
    const instructionBuilder = new InstructionBuilder(validatedArgs.programId, programConfig.idl!);

    // Show what we're about to do
    console.log('🔄 Generating setCanAcceptLiquidity transaction...');
    console.log(`   RPC URL: ${rpcUrl}`);
    console.log(`   Program ID: ${validatedArgs.programId.toString()}`);
    console.log(`   Mint: ${validatedArgs.mint.toString()}`);
    console.log(`   Authority (Pool Owner): ${validatedArgs.authority.toString()}`);
    console.log(`   Allow Liquidity: ${validatedArgs.allow}`);

    // Build the instruction
    console.log('⚙️  Building transaction instruction...');
    const instruction = await instructionBuilder.setCanAcceptLiquidity(
      validatedArgs.mint,
      validatedArgs.authority,
      validatedArgs.allow
    );
    console.log('   ✅ Instruction built successfully');

    // Build the complete transaction
    console.log('🔄 Building and simulating transaction...');
    const transaction = await finalizeTransaction({
      txBuilder: transactionBuilder,
      instructions: [instruction],
      payer: validatedArgs.authority,
      instructionName: 'setCanAcceptLiquidity',
      command,
    });
    console.log('   ✅ Transaction simulation completed');

    cmdLogger.info(
      {
        transactionSize: `${Math.floor(transaction.hex.length / 2)} bytes`,
        computeUnits: transaction.metadata.computeUnits,
      },
      'setCanAcceptLiquidity command completed successfully'
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: errorMessage }, 'setCanAcceptLiquidity command failed');
    if (error instanceof Error && error.stack) {
      cmdLogger.error({ stack: error.stack }, 'Stack trace');
    }

    // Provide helpful error messages
    if (errorMessage.includes('Non-base58 character')) {
      console.error('❌ Invalid Base58 public key format');
      console.error('💡 All public keys must be 44 characters in Base58 format');
    } else if (errorMessage.includes('Invalid boolean')) {
      console.error('❌ Invalid allow value');
      console.error('💡 Allow must be either "true" or "false"');
    } else {
      console.error(`❌ Error: ${errorMessage}`);
    }
    process.exit(1);
  }
}
