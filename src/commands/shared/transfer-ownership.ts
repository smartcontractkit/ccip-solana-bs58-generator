import type { TransactionOptions } from '../../types/index.js';
import { TransferOwnershipArgsSchema } from '../../types/index.js';
import { validateArgs, validateRpcConnectivity } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { TransactionDisplay } from '../../utils/display.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { getProgramConfig, type ProgramName } from '../../types/program-registry.js';
import type { CommandContext, TransferOwnershipOptions } from '../../types/command.js';
import { InstructionBuilder as BurnmintInstructionBuilder } from '../../programs/burnmint-token-pool/instructions.js';
import { InstructionBuilder as LockreleaseInstructionBuilder } from '../../programs/lockrelease-token-pool/instructions.js';

/**
 * Shared transfer ownership implementation
 */
export async function transferOwnership(
  options: TransferOwnershipOptions,
  command: CommandContext,
  programType: ProgramName
): Promise<void> {
  const cmdLogger = createChildLogger(logger, { command: `${programType}.transfer-ownership` });

  try {
    // Get global options and program config
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};
    const programConfig = getProgramConfig(programType);

    if (!programConfig?.idl) {
      console.error(`❌ ${programConfig.displayName} IDL not available`);
      process.exit(1);
    }

    // Validate arguments (this handles the PublicKey conversion)
    const parsed = validateArgs(TransferOwnershipArgsSchema, {
      programId: options.programId,
      mint: options.mint,
      authority: options.authority,
      proposedOwner: options.proposedOwner,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    });

    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      console.error('💡 Expected format:');
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • Authority: Base58 public key (44 characters)');
      console.error('   • Proposed Owner: Base58 public key (44 characters)');
      console.error('   • RPC URL: Valid HTTP/HTTPS URL');
      process.exit(1);
    }

    const { programId, mint, authority, proposedOwner, rpcUrl } = parsed.data;

    // Validate RPC connectivity
    const rpc = rpcUrl ?? (globalOptions.resolvedRpcUrl as string);
    console.log('🔗 Validating RPC connectivity...');
    const ok = await validateRpcConnectivity(rpc);

    if (!ok) {
      console.error(`❌ Cannot connect to RPC endpoint: ${rpc}`);
      console.error('💡 Common RPC URLs:');
      console.error('   • Devnet: https://api.devnet.solana.com');
      console.error('   • Mainnet: https://api.mainnet-beta.solana.com');
      process.exit(1);
    }
    console.log('   ✅ RPC connection verified');

    // Build transaction
    const txOptions: TransactionOptions = { rpcUrl: rpc };
    const txBuilder = new TransactionBuilder(txOptions);

    // Show what we're about to do
    console.log('🔄 Generating transferOwnership transaction...');
    console.log(`   RPC URL: ${rpc}`);
    console.log(`   Program ID: ${programId.toString()}`);
    console.log(`   Mint: ${mint.toString()}`);
    console.log(`   Authority: ${authority.toString()}`);
    console.log(`   Proposed Owner: ${proposedOwner.toString()}`);

    // Create the appropriate instruction builder based on program type
    let ix;
    if (programType === 'burnmint-token-pool') {
      const builder = new BurnmintInstructionBuilder(programId, programConfig.idl);
      console.log('⚙️  Building transaction instruction...');
      ix = await builder.transferOwnership(mint, authority, proposedOwner);
    } else if (programType === 'lockrelease-token-pool') {
      const builder = new LockreleaseInstructionBuilder(programId, programConfig.idl);
      console.log('⚙️  Building transaction instruction...');
      ix = await builder.transferOwnership(mint, authority, proposedOwner);
    } else {
      throw new Error(`Unsupported program type: ${programType}`);
    }
    console.log('   ✅ Instruction built successfully');

    console.log('🔄 Building and simulating transaction...');
    const tx = await txBuilder.buildSingleInstructionTransaction(
      ix,
      authority,
      `${programType}.transfer-ownership`
    );
    console.log('   ✅ Transaction simulation completed');

    TransactionDisplay.displayResults(tx, `${programType}.transfer-ownership`);

    cmdLogger.info(
      {
        transactionSize: `${Math.floor(tx.hex.length / 2)} bytes`,
        computeUnits: tx.metadata.computeUnits,
      },
      'transferOwnership command completed successfully'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: message }, 'transferOwnership failed');

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
      console.error('   • Proposed Owner: Base58 public key (44 characters)');
      console.error('   Example: 11111111111111111111111111111112');
    } else {
      console.error(`❌ ${message}`);
    }
    process.exit(1);
  }
}
