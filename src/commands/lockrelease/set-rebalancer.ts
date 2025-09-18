import type { TransactionOptions } from '../../types/index.js';
import { SetRebalancerArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { TransactionDisplay } from '../../utils/display.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { getProgramConfig } from '../../types/program-registry.js';
import type { CommandContext, SetRebalancerOptions } from '../../types/command.js';
import { InstructionBuilder } from '../../programs/lockrelease-token-pool/instructions.js';

/**
 * Set rebalancer command for lockrelease token pool
 */
export async function setRebalancerCommand(
  options: SetRebalancerOptions,
  command: CommandContext
): Promise<void> {
  const cmdLogger = createChildLogger(logger, {
    command: 'lockrelease.set-rebalancer',
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
        rebalancer: options.rebalancer,
        globalOptions,
      },
      'Starting setRebalancer command'
    );

    // Parse and validate arguments
    const args = {
      programId: options.programId,
      mint: options.mint,
      authority: options.authority,
      rebalancer: options.rebalancer,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    };

    const validation = validateArgs(SetRebalancerArgsSchema, args);
    if (!validation.success) {
      const errorMessage = `Invalid arguments: ${validation.errors.join(', ')}`;
      cmdLogger.error(errorMessage);
      console.error(`❌ ${errorMessage}`);
      console.error('💡 Expected format:');
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • Authority: Base58 public key (44 characters, must be pool owner)');
      console.error('   • Rebalancer: Base58 public key (44 characters)');
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
    console.log('🔄 Generating setRebalancer transaction...');
    console.log(`   RPC URL: ${rpcUrl}`);
    console.log(`   Program ID: ${validatedArgs.programId.toString()}`);
    console.log(`   Mint: ${validatedArgs.mint.toString()}`);
    console.log(`   Authority (Pool Owner): ${validatedArgs.authority.toString()}`);
    console.log(`   New Rebalancer: ${validatedArgs.rebalancer.toString()}`);

    // Build the instruction
    console.log('⚙️  Building transaction instruction...');
    const instruction = await instructionBuilder.setRebalancer(
      validatedArgs.mint,
      validatedArgs.authority,
      validatedArgs.rebalancer
    );
    console.log('   ✅ Instruction built successfully');

    // Build the complete transaction
    console.log('🔄 Building and simulating transaction...');
    const transaction = await transactionBuilder.buildSingleInstructionTransaction(
      instruction,
      validatedArgs.authority,
      'setRebalancer'
    );
    console.log('   ✅ Transaction simulation completed');

    // Display results
    TransactionDisplay.displayResults(transaction, 'setRebalancer');

    cmdLogger.info(
      {
        transactionSize: `${Math.floor(transaction.hex.length / 2)} bytes`,
        computeUnits: transaction.metadata.computeUnits,
      },
      'setRebalancer command completed successfully'
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: errorMessage }, 'setRebalancer command failed');
    if (error instanceof Error && error.stack) {
      cmdLogger.error({ stack: error.stack }, 'Stack trace');
    }

    // Provide helpful error messages
    if (errorMessage.includes('Non-base58 character')) {
      console.error('❌ Invalid Base58 public key format');
      console.error('💡 All public keys must be 44 characters in Base58 format');
    } else if (errorMessage.includes('Unauthorized')) {
      console.error('❌ Unauthorized');
      console.error('💡 Authority must be the current pool owner');
    } else {
      console.error(`❌ Error: ${errorMessage}`);
    }
    process.exit(1);
  }
}
