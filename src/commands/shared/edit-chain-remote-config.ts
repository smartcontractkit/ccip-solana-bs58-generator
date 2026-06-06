import type { TransactionOptions } from '../../types/index.js';
import { EditChainRemoteConfigArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { finalizeTransaction } from '../../utils/finalize-transaction.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { getProgramConfig, type ProgramName } from '../../types/program-registry.js';
import type { CommandContext, EditChainRemoteConfigOptions } from '../../types/command.js';
import { InstructionBuilder as BurnmintInstructionBuilder } from '../../programs/burnmint-token-pool/instructions.js';
import { InstructionBuilder as LockreleaseInstructionBuilder } from '../../programs/lockrelease-token-pool/instructions.js';

/**
 * Shared edit chain remote config implementation
 */
export async function editChainRemoteConfig(
  options: EditChainRemoteConfigOptions,
  command: CommandContext,
  programType: ProgramName
): Promise<void> {
  const cmdLogger = createChildLogger(logger, {
    command: `${programType}.edit-chain-remote-config`,
  });

  try {
    // Get global options from parent command (handle both nested and top-level)
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};

    // Log command start with structured data
    cmdLogger.info(
      {
        programId: options.programId,
        mint: options.mint,
        authority: options.authority,
        remoteChainSelector: options.remoteChainSelector,
        poolAddresses: options.poolAddresses,
        tokenAddress: options.tokenAddress,
        decimals: options.decimals,
        globalOptions,
      },
      'Starting editChainRemoteConfig command'
    );

    // Parse and validate arguments - input as strings, schema will transform to appropriate types
    const args = {
      programId: options.programId,
      mint: options.mint,
      authority: options.authority,
      remoteChainSelector: options.remoteChainSelector,
      poolAddresses: options.poolAddresses,
      tokenAddress: options.tokenAddress,
      decimals: options.decimals,
      rpcUrl: globalOptions.resolvedRpcUrl!, // Resolved from --env or --rpc-url
    };

    const validation = validateArgs(EditChainRemoteConfigArgsSchema, args);
    if (!validation.success) {
      const errorMessage = `Invalid arguments: ${validation.errors.join(', ')}`;
      cmdLogger.error(errorMessage);
      console.error(`❌ ${errorMessage}`);
      console.error('💡 Expected format:');
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • Authority: Base58 public key (44 characters)');
      console.error('   • Remote Chain Selector: Number (u64)');
      console.error('   • Pool Addresses: JSON array of hex strings');
      console.error('   • Token Address: Hex string');
      console.error('   • Decimals: Number (0-255)');
      console.error('   • RPC URL: Valid HTTP/HTTPS URL');
      console.error('');
      console.error('Example pool addresses: ["0x1234abcd...", "0x5678efgh..."]');
      process.exit(1);
    }

    const validatedArgs = validation.data;

    // Since we verified rpcUrl exists in preAction hook, we can safely use it
    const rpcUrl = validatedArgs.rpcUrl || globalOptions.resolvedRpcUrl!;

    // Load IDL and validate instruction exists
    cmdLogger.debug('Loading IDL and validating instruction');
    const programConfig = getProgramConfig(programType);
    if (!programConfig?.idl) {
      const errorMessage = `${programConfig.displayName} IDL not available`;
      cmdLogger.error(errorMessage);
      console.error(`❌ ${errorMessage}`);
      process.exit(1);
    }

    // Create transaction builder
    const transactionOptions: TransactionOptions = {
      rpcUrl,
    };

    const transactionBuilder = new TransactionBuilder(transactionOptions);

    // Create the appropriate instruction builder based on program type
    let instructionBuilder: BurnmintInstructionBuilder | LockreleaseInstructionBuilder;

    if (programType === 'burnmint-token-pool') {
      instructionBuilder = new BurnmintInstructionBuilder(
        validatedArgs.programId,
        programConfig.idl!
      );
    } else if (programType === 'lockrelease-token-pool') {
      instructionBuilder = new LockreleaseInstructionBuilder(
        validatedArgs.programId,
        programConfig.idl!
      );
    } else {
      console.error(`❌ Unsupported program type: ${programType}`);
      process.exit(1);
    }

    // Show what we're about to do
    console.log('🔄 Generating editChainRemoteConfig transaction...');
    console.log(`   RPC URL: ${rpcUrl}`);
    console.log(`   Program ID: ${validatedArgs.programId.toString()}`);
    console.log(`   Mint: ${validatedArgs.mint.toString()}`);
    console.log(`   Authority: ${validatedArgs.authority.toString()}`);
    console.log(`   Remote Chain Selector: ${validatedArgs.remoteChainSelector}`);
    console.log(`   Pool Addresses: ${validatedArgs.poolAddresses.length} addresses`);
    console.log(`   Token Address: ${validatedArgs.tokenAddress}`);
    console.log(`   Decimals: ${validatedArgs.decimals}`);

    // Build the instruction using Anchor (async now!)
    console.log('⚙️  Building transaction instruction...');
    const instruction = await instructionBuilder.editChainRemoteConfig(
      validatedArgs.mint,
      validatedArgs.authority,
      validatedArgs.remoteChainSelector,
      validatedArgs.poolAddresses,
      validatedArgs.tokenAddress,
      validatedArgs.decimals
    );
    console.log('   ✅ Instruction built successfully');

    // Build the complete transaction (includes automatic simulation)
    console.log('🔄 Building and simulating transaction...');
    const transaction = await finalizeTransaction({
      txBuilder: transactionBuilder,
      instructions: [instruction],
      payer: validatedArgs.authority,
      instructionName: 'editChainRemoteConfig',
      command,
    });
    console.log('   ✅ Transaction simulation completed');

    cmdLogger.info(
      {
        transactionSize: `${Math.floor(transaction.hex.length / 2)} bytes`,
        computeUnits: transaction.metadata.computeUnits,
      },
      'editChainRemoteConfig command completed successfully'
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: errorMessage }, 'editChainRemoteConfig command failed');
    if (error instanceof Error && error.stack) {
      cmdLogger.error({ stack: error.stack }, 'Stack trace');
    }

    // Provide helpful error messages for common issues
    if (errorMessage.includes('Non-base58 character')) {
      console.error('❌ Invalid Base58 public key format');
      console.error('💡 Expected format:');
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • Authority: Base58 public key (44 characters)');
      console.error('   Example: 11111111111111111111111111111112');
    } else if (errorMessage.includes('Invalid JSON')) {
      console.error('❌ Invalid JSON format');
      console.error('💡 Expected format:');
      console.error('   • Pool addresses: ["0x1234abcd...", "0x5678efgh..."]');
      console.error('   • Must be valid JSON array of hex strings');
    } else if (errorMessage.includes('Invalid number') || errorMessage.includes('Decimals')) {
      console.error('❌ Invalid number format');
      console.error('💡 Expected format:');
      console.error('   • Remote Chain Selector: Positive integer');
      console.error('   • Decimals: Integer between 0 and 255');
      console.error('   Example: 1234567890');
    } else {
      console.error(`❌ Error: ${errorMessage}`);
    }
    process.exit(1);
  }
}
