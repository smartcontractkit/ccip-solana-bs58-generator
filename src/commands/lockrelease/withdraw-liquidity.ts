import type { TransactionOptions } from '../../types/index.js';
import { WithdrawLiquidityArgsSchema } from '../../types/index.js';
import { validateArgs, validateRpcConnectivity } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { TransactionDisplay } from '../../utils/display.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { getProgramConfig } from '../../types/program-registry.js';
import type { CommandContext, WithdrawLiquidityOptions } from '../../types/command.js';
import { InstructionBuilder } from '../../programs/lockrelease-token-pool/instructions.js';
import { detectTokenProgramId } from '../../utils/token.js';
import { Connection } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

/**
 * Withdraw liquidity command for lockrelease token pool
 */
export async function withdrawLiquidityCommand(
  options: WithdrawLiquidityOptions,
  command: CommandContext
): Promise<void> {
  const cmdLogger = createChildLogger(logger, {
    command: 'lockrelease.withdraw-liquidity',
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
        amount: options.amount,
        globalOptions,
      },
      'Starting withdrawLiquidity command'
    );

    // Parse and validate arguments
    const args = {
      programId: options.programId,
      mint: options.mint,
      authority: options.authority,
      amount: options.amount,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    };

    const validation = validateArgs(WithdrawLiquidityArgsSchema, args);
    if (!validation.success) {
      const errorMessage = `Invalid arguments: ${validation.errors.join(', ')}`;
      cmdLogger.error(errorMessage);
      console.error(`❌ ${errorMessage}`);
      console.error('💡 Expected format:');
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • Authority: Base58 public key (44 characters, must be rebalancer)');
      console.error('   • Amount: Positive number (in smallest token units)');
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

    // Validate RPC connectivity
    console.log('🔗 Validating RPC connectivity...');
    cmdLogger.debug({ rpcUrl }, 'Validating RPC connectivity');
    const isConnected = await validateRpcConnectivity(rpcUrl);
    if (!isConnected) {
      const errorMessage = `Cannot connect to RPC endpoint: ${rpcUrl}`;
      cmdLogger.error(errorMessage);
      console.error(`❌ ${errorMessage}`);
      console.error('💡 Common RPC URLs:');
      console.error('   • Devnet: https://api.devnet.solana.com');
      console.error('   • Mainnet: https://api.mainnet-beta.solana.com');
      process.exit(1);
    }
    console.log('   ✅ RPC connection verified');

    // Detect token program on-chain
    console.log('🔍 Detecting token program...');
    const connection = new Connection(rpcUrl);
    const tokenProgram = await detectTokenProgramId(connection, validatedArgs.mint);
    console.log(`   ✅ Detected token program: ${tokenProgram.toString()}`);

    // Derive rebalancer's Associated Token Account
    console.log('🔍 Deriving rebalancer Associated Token Account...');
    const userTokenAccount = getAssociatedTokenAddressSync(
      validatedArgs.mint,
      validatedArgs.authority, // Use authority (rebalancer) address
      true, // allowOwnerOffCurve
      tokenProgram
    );
    console.log(`   ✅ Rebalancer ATA: ${userTokenAccount.toString()}`);

    // Create transaction builder
    const transactionOptions: TransactionOptions = {
      rpcUrl,
    };

    const transactionBuilder = new TransactionBuilder(transactionOptions);

    // Create instruction builder
    const instructionBuilder = new InstructionBuilder(validatedArgs.programId, programConfig.idl!);

    // Show what we're about to do
    console.log('🔄 Generating withdrawLiquidity transaction...');
    console.log(`   RPC URL: ${rpcUrl}`);
    console.log(`   Program ID: ${validatedArgs.programId.toString()}`);
    console.log(`   Mint: ${validatedArgs.mint.toString()}`);
    console.log(`   Authority (Rebalancer): ${validatedArgs.authority.toString()}`);
    console.log(`   Amount: ${validatedArgs.amount.toString()}`);
    console.log(`   Rebalancer Token Account (ATA): ${userTokenAccount.toString()}`);
    console.log(`   Token Program: ${tokenProgram.toString()}`);

    // Build the instruction
    console.log('⚙️  Building transaction instruction...');
    const instruction = await instructionBuilder.withdrawLiquidity(
      validatedArgs.mint,
      validatedArgs.authority,
      validatedArgs.amount,
      tokenProgram,
      userTokenAccount
    );
    console.log('   ✅ Instruction built successfully');

    // Build the complete transaction
    console.log('🔄 Building and simulating transaction...');
    const transaction = await transactionBuilder.buildSingleInstructionTransaction(
      instruction,
      validatedArgs.authority,
      'withdrawLiquidity'
    );
    console.log('   ✅ Transaction simulation completed');

    // Display results
    TransactionDisplay.displayResults(transaction, 'withdrawLiquidity');

    cmdLogger.info(
      {
        transactionSize: `${Math.floor(transaction.hex.length / 2)} bytes`,
        computeUnits: transaction.metadata.computeUnits,
      },
      'withdrawLiquidity command completed successfully'
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: errorMessage }, 'withdrawLiquidity command failed');
    if (error instanceof Error && error.stack) {
      cmdLogger.error({ stack: error.stack }, 'Stack trace');
    }

    // Provide helpful error messages
    if (errorMessage.includes('Non-base58 character')) {
      console.error('❌ Invalid Base58 public key format');
      console.error('💡 All public keys must be 44 characters in Base58 format');
    } else if (errorMessage.includes('Amount must be positive')) {
      console.error('❌ Invalid amount');
      console.error('💡 Amount must be a positive number in smallest token units');
    } else if (errorMessage.includes('Token program')) {
      console.error('❌ Token program detection failed');
      console.error('💡 Make sure the mint address exists on-chain');
    } else {
      console.error(`❌ Error: ${errorMessage}`);
    }
    process.exit(1);
  }
}
