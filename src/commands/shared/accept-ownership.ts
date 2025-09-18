import type { TransactionOptions } from '../../types/index.js';
import { AcceptOwnershipArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { TransactionDisplay } from '../../utils/display.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { getProgramConfig, type ProgramName } from '../../types/program-registry.js';
import type { CommandContext, AcceptOwnershipOptions } from '../../types/command.js';
import { InstructionBuilder as BurnmintInstructionBuilder } from '../../programs/burnmint-token-pool/instructions.js';
import { InstructionBuilder as LockreleaseInstructionBuilder } from '../../programs/lockrelease-token-pool/instructions.js';

/**
 * Shared accept ownership implementation
 */
export async function acceptOwnership(
  options: AcceptOwnershipOptions,
  command: CommandContext,
  programType: ProgramName
): Promise<void> {
  const cmdLogger = createChildLogger(logger, { command: `${programType}.accept-ownership` });

  try {
    // Get global options and program config
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};
    const programConfig = getProgramConfig(programType);

    if (!programConfig?.idl) {
      console.error(`❌ ${programConfig.displayName} IDL not available`);
      process.exit(1);
    }

    // Validate arguments (this handles the PublicKey conversion)
    const parsed = validateArgs(AcceptOwnershipArgsSchema, {
      programId: options.programId,
      mint: options.mint,
      authority: options.authority,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    });

    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      console.error('💡 Expected format:');
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • Authority: Base58 public key (44 characters)');
      console.error('   • RPC URL: Valid HTTP/HTTPS URL');
      process.exit(1);
    }

    const { programId, mint, authority, rpcUrl } = parsed.data;

    const rpc = rpcUrl ?? (globalOptions.resolvedRpcUrl as string);

    // Build transaction
    const txOptions: TransactionOptions = { rpcUrl: rpc };
    const txBuilder = new TransactionBuilder(txOptions);

    // Show what we're about to do
    console.log('🔄 Generating acceptOwnership transaction...');
    console.log(`   RPC URL: ${rpc}`);
    console.log(`   Program ID: ${programId.toString()}`);
    console.log(`   Mint: ${mint.toString()}`);
    console.log(`   Authority: ${authority.toString()}`);

    // Create the appropriate instruction builder based on program type
    let ix;
    if (programType === 'burnmint-token-pool') {
      const builder = new BurnmintInstructionBuilder(programId, programConfig.idl);
      console.log('⚙️  Building transaction instruction...');
      ix = await builder.acceptOwnership(mint, authority);
    } else if (programType === 'lockrelease-token-pool') {
      const builder = new LockreleaseInstructionBuilder(programId, programConfig.idl);
      console.log('⚙️  Building transaction instruction...');
      ix = await builder.acceptOwnership(mint, authority);
    } else {
      throw new Error(`Unsupported program type: ${programType}`);
    }
    console.log('   ✅ Instruction built successfully');

    console.log('🔄 Building and simulating transaction...');
    const tx = await txBuilder.buildSingleInstructionTransaction(
      ix,
      authority,
      `${programType}.accept-ownership`
    );
    console.log('   ✅ Transaction simulation completed');

    TransactionDisplay.displayResults(tx, `${programType}.accept-ownership`);

    cmdLogger.info(
      {
        transactionSize: `${Math.floor(tx.hex.length / 2)} bytes`,
        computeUnits: tx.metadata.computeUnits,
      },
      'acceptOwnership command completed successfully'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: message }, 'acceptOwnership failed');

    if (error instanceof Error && error.stack) {
      cmdLogger.error({ stack: error.stack }, 'Stack trace');
    }

    // Provide helpful error messages for common issues
    if (message.includes('Non-base58 character')) {
      console.error('❌ Invalid Base58 public key format');
      console.error('💡 Expected format:');
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • Authority: Base58 public key (44 characters)');
      console.error('   Example: 11111111111111111111111111111112');
    } else {
      console.error(`❌ ${message}`);
    }
    process.exit(1);
  }
}
