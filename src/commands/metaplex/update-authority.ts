import { Command } from 'commander';
import { TransactionInstruction, PublicKey } from '@solana/web3.js';
import { validateArgs } from '../../utils/validation.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { finalizeTransaction } from '../../utils/finalize-transaction.js';
import { MetaplexUpdateAuthorityArgsSchema } from '../../types/index.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { InstructionBuilder as MplInstructionBuilder } from '../../programs/metaplex/instructions.js';
import { logger } from '../../utils/logger.js';
import { publicKey as umiPk, signerIdentity, createNoopSigner } from '@metaplex-foundation/umi';
import { findMetadataPda, fetchMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { detectTokenProgramId } from '../../utils/token.js';
import { Connection } from '@solana/web3.js';

export async function updateMetadataAuthorityCommand(
  options: Record<string, string>,
  command: Command
) {
  const global = command.parent?.opts() || {};
  const parsed = validateArgs(MetaplexUpdateAuthorityArgsSchema, {
    authority: options.authority,
    mint: options.mint,
    newAuthority: options.newAuthority,
    rpcUrl: global.resolvedRpcUrl,
  });
  if (!parsed.success) {
    console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
    process.exit(1);
  }
  const rpcUrl = parsed.data.rpcUrl ?? (global.resolvedRpcUrl as string);

  const umi = createUmi(rpcUrl).use(
    signerIdentity(createNoopSigner(umiPk(parsed.data.authority.toBase58())))
  );

  // Validate Metaplex metadata existence and current authority
  await validateMetaplexMetadata(umi, parsed.data.mint, parsed.data.authority, rpcUrl);

  const mpl = new MplInstructionBuilder(umi);
  const ix = mpl.updateAuthority(parsed.data.mint.toBase58(), parsed.data.newAuthority.toBase58());

  const ixs: TransactionInstruction[] = [ix];
  const tb = new TransactionBuilder({ rpcUrl });
  logger.info('🔄 Building and simulating transaction...');
  await finalizeTransaction({
    txBuilder: tb,
    instructions: ixs,
    payer: parsed.data.authority as PublicKey,
    instructionName: 'metaplex.update_authority',
    command,
  });
  logger.info('✅ Transaction simulation completed');
}

/**
 * Validate that Metaplex metadata exists and verify current update authority
 */
async function validateMetaplexMetadata(
  umi: ReturnType<typeof createUmi>,
  mint: PublicKey,
  providedAuthority: PublicKey,
  rpcUrl: string
): Promise<void> {
  try {
    logger.info('🔍 Validating Metaplex metadata...');

    // Detect and log token program for user friendliness
    const connection = new Connection(rpcUrl);
    const tokenProgramId = await detectTokenProgramId(connection, mint);
    logger.info(`📋 Mint: ${mint.toBase58()}`);
    logger.info(`📋 Token Program: ${tokenProgramId.toBase58()}`);

    // Find the metadata PDA for this mint
    const metadataPda = findMetadataPda(umi, { mint: umiPk(mint.toBase58()) });
    logger.info(`📋 Metadata PDA: ${metadataPda[0]}`);

    // Check if metadata account exists
    const metadataAccount = await umi.rpc.getAccount(metadataPda[0]);
    if (!metadataAccount.exists) {
      logger.error(`❌ No Metaplex metadata found for mint: ${mint.toBase58()}`);
      console.error('❌ This mint does not have Metaplex metadata.');
      console.error('💡 Ensure you are using a mint with Metaplex Token Metadata.');
      console.error(
        '💡 For Token-2022 metadata extension, use: spl-token --instruction update-metadata-authority'
      );
      console.error(`💡 This mint uses token program: ${tokenProgramId.toBase58()}`);
      process.exit(1);
    }
    logger.info('✅ Metaplex metadata account exists');

    // Fetch metadata to get current update authority
    const metadata = await fetchMetadata(umi, metadataPda[0]);
    const currentAuthority = metadata.updateAuthority;

    logger.info(`📋 Current update authority: ${currentAuthority}`);
    logger.info(`📋 Provided authority: ${providedAuthority.toBase58()}`);

    // Verify that provided authority matches current update authority
    if (currentAuthority.toString() !== providedAuthority.toBase58()) {
      logger.warn('⚠️  WARNING: Authority mismatch detected!');
      console.warn(
        '⚠️  WARNING: The provided authority does not match the current update authority.'
      );
      console.warn(`   Current update authority: ${currentAuthority}`);
      console.warn(`   Provided authority: ${providedAuthority.toBase58()}`);
      console.warn('');
      console.warn('🚨 This transaction will likely FAIL when executed.');
      console.warn('💡 Ensure you are using the correct current update authority.');
      console.warn('💡 Double-check the metadata account details before proceeding.');
    } else {
      logger.info('✅ Authority verification passed');
    }

    logger.info('✅ Metaplex metadata validation completed');
  } catch (error) {
    logger.error('❌ Failed to validate Metaplex metadata');
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    console.error('❌ Failed to validate Metaplex metadata for this mint.');
    console.error('💡 Ensure the mint has valid Metaplex Token Metadata.');
    console.error('💡 Check your RPC connection and try again.');
    process.exit(1);
  }
}
