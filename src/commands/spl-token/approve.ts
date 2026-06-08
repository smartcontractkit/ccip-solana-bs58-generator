import type { TransactionOptions } from '../../types/index.js';
import { ApproveArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { finalizeTransaction } from '../../utils/finalize-transaction.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import type { CommandContext, ApproveOptions } from '../../types/command.js';
import { InstructionBuilder } from '../../programs/spl-token/instructions.js';
import { detectTokenProgramId } from '../../utils/token.js';
import { Connection } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

/**
 * Approve delegate command for SPL Token
 */
export async function approveCommand(
  options: ApproveOptions,
  command: CommandContext
): Promise<void> {
  const cmdLogger = createChildLogger(logger, {
    command: 'spl-token.approve',
  });

  try {
    // Get global options from parent command
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};

    // Log command start
    cmdLogger.info(
      {
        mint: options.mint,
        tokenAccount: options.tokenAccount,
        delegate: options.delegate,
        authority: options.authority,
        amount: options.amount,
        globalOptions,
      },
      'Starting approve command'
    );

    // Parse and validate arguments
    const args = {
      mint: options.mint,
      tokenAccount: options.tokenAccount,
      delegate: options.delegate,
      authority: options.authority,
      amount: options.amount,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    };

    const validation = validateArgs(ApproveArgsSchema, args);
    if (!validation.success) {
      const errorMessage = `Invalid arguments: ${validation.errors.join(', ')}`;
      cmdLogger.error(errorMessage);
      console.error(`❌ ${errorMessage}`);
      console.error('💡 Expected format:');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • Token Account: Base58 public key (44 characters, or use --auto-derive)');
      console.error('   • Delegate: Base58 public key (44 characters)');
      console.error('   • Authority: Base58 public key (44 characters, token account owner)');
      console.error('   • Amount: Positive number (in smallest token units)');
      console.error('   • RPC URL: Valid HTTP/HTTPS URL');
      process.exit(1);
    }

    const validatedArgs = validation.data;
    const rpcUrl = validatedArgs.rpcUrl || globalOptions.resolvedRpcUrl!;

    // Detect token program on-chain
    console.log('🔍 Detecting token program...');
    const connection = new Connection(rpcUrl);
    const tokenProgram = await detectTokenProgramId(connection, validatedArgs.mint);
    console.log(`   ✅ Detected token program: ${tokenProgram.toString()}`);

    // Derive token account if auto-derive is requested
    let tokenAccount = validatedArgs.tokenAccount;
    if (!tokenAccount) {
      console.log('🔍 Auto-deriving Associated Token Account...');
      tokenAccount = getAssociatedTokenAddressSync(
        validatedArgs.mint,
        validatedArgs.authority,
        true, // allowOwnerOffCurve
        tokenProgram
      );
      console.log(`   ✅ Derived ATA: ${tokenAccount.toString()}`);
    }

    // Create transaction builder
    const transactionOptions: TransactionOptions = {
      rpcUrl,
    };

    const transactionBuilder = new TransactionBuilder(transactionOptions);

    // Create instruction builder
    const instructionBuilder = new InstructionBuilder(tokenProgram);

    // Show what we're about to do
    console.log('🔄 Generating approve transaction...');
    console.log(`   RPC URL: ${rpcUrl}`);
    console.log(`   Token Program: ${tokenProgram.toString()}`);
    console.log(`   Mint: ${validatedArgs.mint.toString()}`);
    console.log(`   Token Account: ${tokenAccount.toString()}`);
    console.log(`   Delegate: ${validatedArgs.delegate.toString()}`);
    console.log(`   Authority (Token Account Owner): ${validatedArgs.authority.toString()}`);
    console.log(`   Amount: ${validatedArgs.amount.toString()}`);

    // Build the instruction
    console.log('⚙️  Building transaction instruction...');
    const instruction = instructionBuilder.approve(
      tokenAccount,
      validatedArgs.delegate,
      validatedArgs.authority,
      validatedArgs.amount
    );
    console.log('   ✅ Instruction built successfully');

    // Build the complete transaction
    console.log('🔄 Building and simulating transaction...');
    const transaction = await finalizeTransaction({
      txBuilder: transactionBuilder,
      instructions: [instruction],
      payer: validatedArgs.authority,
      instructionName: 'approve',
      command,
    });
    console.log('   ✅ Transaction simulation completed');

    cmdLogger.info(
      {
        transactionSize: `${Math.floor(transaction.hex.length / 2)} bytes`,
        computeUnits: transaction.metadata.computeUnits,
      },
      'approve command completed successfully'
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: errorMessage }, 'approve command failed');
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
    } else {
      console.error(`❌ Error: ${errorMessage}`);
    }
    process.exit(1);
  }
}
