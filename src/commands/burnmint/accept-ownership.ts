import type { TransactionOptions } from '../../types/index.js';
import { AcceptOwnershipArgsSchema } from '../../types/index.js';
import { validateArgs, validateRpcConnectivity } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { InstructionBuilder } from '../../programs/burnmint-token-pool/instructions.js';
import { getProgramConfig } from '../../types/program-registry.js';

/**
 * Accept ownership command implementation
 */
export async function acceptOwnershipCommand(
  options: { programId: string; mint: string; authority: string },
  command: {
    parent?: {
      parent?: { opts(): { rpcUrl?: string; verbose?: boolean; resolvedRpcUrl?: string } };
      opts(): { rpcUrl?: string; verbose?: boolean; resolvedRpcUrl?: string };
    };
  }
): Promise<void> {
  const commandLogger = createChildLogger(logger, { command: 'accept-ownership' });

  try {
    // Get global options from parent command (handle both nested and top-level)
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};

    // Log command start with structured data
    commandLogger.info(
      {
        programId: options.programId,
        mint: options.mint,
        authority: options.authority,
        globalOptions,
      },
      'Starting acceptOwnership command'
    );

    // Parse and validate arguments - input as strings, schema will transform to PublicKey
    const args = {
      programId: options.programId,
      mint: options.mint,
      authority: options.authority,
      rpcUrl: globalOptions.resolvedRpcUrl!, // Resolved from --env or --rpc-url
    };

    const validation = validateArgs(AcceptOwnershipArgsSchema, args);
    if (!validation.success) {
      const errorMessage = `Invalid arguments: ${validation.errors.join(', ')}`;
      commandLogger.error(errorMessage);
      console.error(`❌ ${errorMessage}`);
      console.error('💡 Expected format:');
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • Authority: Base58 public key (44 characters)');
      console.error('   • RPC URL: Valid HTTP/HTTPS URL');
      process.exit(1);
    }

    const validatedArgs = validation.data;

    // Since we verified rpcUrl exists in preAction hook, we can safely use it
    const rpcUrl = validatedArgs.rpcUrl || globalOptions.resolvedRpcUrl!;

    // Load IDL and validate instruction exists
    commandLogger.debug('Loading IDL and validating instruction');
    const programConfig = getProgramConfig('burnmint-token-pool');
    if (!programConfig?.idl) {
      const errorMessage = 'Burnmint token pool IDL not available';
      commandLogger.error(errorMessage);
      console.error(`❌ ${errorMessage}`);
      process.exit(1);
    }

    // Validate RPC connectivity (always required now)
    console.log('🔗 Validating RPC connectivity...');
    commandLogger.debug({ rpcUrl }, 'Validating RPC connectivity');
    const isConnected = await validateRpcConnectivity(rpcUrl);
    if (!isConnected) {
      const errorMessage = `Cannot connect to RPC endpoint: ${rpcUrl}`;
      commandLogger.error(errorMessage);
      console.error(`❌ ${errorMessage}`);
      console.error('💡 Common RPC URLs:');
      console.error('   • Devnet: https://api.devnet.solana.com');
      console.error('   • Mainnet: https://api.mainnet-beta.solana.com');
      process.exit(1);
    }
    console.log('   ✅ RPC connection verified');
    commandLogger.debug('RPC connectivity validated');

    // Create transaction builder
    const transactionOptions: TransactionOptions = {
      rpcUrl,
    };

    const transactionBuilder = new TransactionBuilder(transactionOptions);

    // Create instruction builder with IDL and RPC URL
    const instructionBuilder = new InstructionBuilder(
      validatedArgs.programId,
      programConfig.idl!,
      rpcUrl
    );

    // Show what we're about to do
    console.log('🔄 Generating acceptOwnership transaction...');
    console.log(`   RPC URL: ${rpcUrl}`);
    console.log(`   Program ID: ${validatedArgs.programId.toString()}`);
    console.log(`   Mint: ${validatedArgs.mint.toString()}`);
    console.log(`   Authority: ${validatedArgs.authority.toString()}`);

    // Build the instruction using Anchor (async now!)
    console.log('⚙️  Building transaction instruction...');
    const instruction = await instructionBuilder.acceptOwnership(
      validatedArgs.mint,
      validatedArgs.authority
    );
    console.log('   ✅ Instruction built successfully');

    // Build the complete transaction (includes automatic simulation)
    console.log('🔄 Building and simulating transaction...');
    const transaction = await transactionBuilder.buildSingleInstructionTransaction(
      instruction,
      validatedArgs.authority,
      'acceptOwnership'
    );
    console.log('   ✅ Transaction simulation completed');

    // Display results
    console.log('\\n✅ Transaction generated successfully!');
    console.log('\\n📋 Transaction Details:');
    console.log(`   Instruction: ${transaction.instruction}`);
    console.log(`   Base58 length: ${transaction.base58.length} characters`);
    console.log(
      `   Compute units: ${transaction.metadata.computeUnits?.toLocaleString() || 'Unknown (simulation failed)'}`
    );
    console.log(`   Generated at: ${transaction.metadata.generatedAt}`);

    console.log('\\n🔗 Transaction Data (Base58):');
    console.log(`\\n${transaction.base58}`);

    console.log('\\n📊 Account Information:');
    console.log(`   Total accounts: ${transaction.accounts.length}`);
    transaction.accounts.forEach((account, index) => {
      console.log(
        `   ${index + 1}. ${account.pubkey} ${account.isSigner ? '(signer)' : ''} ${account.isWritable ? '(writable)' : '(read-only)'}`
      );
    });

    console.log('\\n💡 Usage Instructions:');
    console.log('   1. Copy the Base58 transaction data above');
    console.log('   2. Paste it into Squads multisig as a "Custom Transaction"');
    console.log('   3. Review and approve with your multisig signers');
    console.log('   4. Execute the transaction on Solana');
    console.log(
      '\\n🔍 Note: Transaction was automatically simulated for validation and compute unit estimation'
    );

    commandLogger.info(
      {
        transactionSize: transaction.base58.length,
        computeUnits: transaction.metadata.computeUnits,
      },
      'acceptOwnership command completed successfully'
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    commandLogger.error({ error: errorMessage }, 'acceptOwnership command failed');

    // Provide helpful error messages for common issues
    if (errorMessage.includes('Non-base58 character')) {
      console.error('❌ Invalid Base58 public key format');
      console.error('💡 Expected format:');
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • Authority: Base58 public key (44 characters)');
      console.error('   Example: 11111111111111111111111111111112');
    } else {
      console.error(`❌ Error: ${errorMessage}`);
    }
    process.exit(1);
  }
}
