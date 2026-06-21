import { Command } from 'commander';
import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { validateArgs } from '../../utils/validation.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { finalizeTransaction } from '../../utils/finalize-transaction.js';
import { CreateMintArgsSchema } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { findAssociatedTokenAddress } from '../../utils/token.js';
import { InstructionBuilder as SplInstructionBuilder } from '../../programs/spl-token/instructions.js';

// Type for validated create mint parameters
type CreateMintParams = {
  authority: PublicKey;
  decimals: number;
  tokenProgram: 'spl-token' | 'token-2022';
  withMetaplex: boolean;
  name?: string | undefined;
  symbol?: string | undefined;
  uri?: string | undefined;
  initialSupply?: bigint | undefined;
  recipient?: PublicKey | undefined;
};

// Metaplex UMI imports
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplTokenMetadata,
  findMetadataPda,
  createV1,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { mplToolbox } from '@metaplex-foundation/mpl-toolbox';
import {
  publicKey as umiPk,
  signerIdentity,
  createNoopSigner,
  percentAmount,
} from '@metaplex-foundation/umi';
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';

export async function createMintCommand(options: Record<string, string>, command: Command) {
  const global = command.parent?.opts() || {};

  const parsed = validateArgs(CreateMintArgsSchema, {
    authority: options.authority,
    decimals: options.decimals ? parseInt(options.decimals, 10) : undefined,
    name: options.name,
    symbol: options.symbol,
    uri: options.uri,
    tokenProgram: options.tokenProgram,
    withMetaplex: options.withMetaplex === 'true',
    initialSupply: options.initialSupply,
    recipient: options.recipient,
    rpcUrl: global.resolvedRpcUrl,
  });

  if (!parsed.success) {
    console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
    process.exit(1);
  }

  const rpcUrl = parsed.data.rpcUrl ?? (global.resolvedRpcUrl as string);

  const connection = new Connection(rpcUrl);

  // Validate parameters
  await validateCreateMintParameters(parsed.data);

  if (parsed.data.withMetaplex) {
    // Create mint with Metaplex metadata
    await createMintWithMetaplex(parsed.data, rpcUrl, command);
  } else {
    // Create plain mint without metadata
    await createPlainMint(parsed.data, connection, rpcUrl, command);
  }
}

/**
 * Validate create mint parameters for consistency and requirements
 */
async function validateCreateMintParameters(params: CreateMintParams): Promise<void> {
  logger.info('🔍 Validating create mint parameters...');

  // Validate token program
  const tokenProgramId =
    params.tokenProgram === 'token-2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  logger.info(`📋 Token Program: ${params.tokenProgram} (${tokenProgramId.toBase58()})`);

  // Validate decimals
  if (params.decimals < 0 || params.decimals > 255) {
    console.error('❌ Decimals must be between 0 and 255');
    process.exit(1);
  }
  logger.info(`📋 Decimals: ${params.decimals}`);

  // Validate Metaplex parameters if enabled
  if (params.withMetaplex) {
    if (!params.name || params.name.length > 32) {
      console.error('❌ Name is required and must be ≤32 characters when using Metaplex');
      process.exit(1);
    }
    if (!params.symbol || params.symbol.length > 10) {
      console.error('❌ Symbol is required and must be ≤10 characters when using Metaplex');
      process.exit(1);
    }
    if (!params.uri) {
      console.error('❌ URI is required when using Metaplex metadata');
      process.exit(1);
    }
    logger.info(`📋 Metaplex metadata enabled`);
    logger.info(`   Name: "${params.name}"`);
    logger.info(`   Symbol: "${params.symbol}"`);
    logger.info(`   URI: ${params.uri}`);
  } else {
    logger.info(`📋 Plain mint (no metadata)`);
  }

  // Validate initial supply parameters
  if (params.initialSupply && params.initialSupply > 0) {
    if (!params.recipient) {
      console.error('❌ Recipient is required when initial supply > 0');
      process.exit(1);
    }
    logger.info(`📋 Initial supply: ${params.initialSupply.toString()} smallest units`);
    logger.info(`📋 Recipient: ${params.recipient.toBase58()}`);
  } else {
    logger.info(`📋 No initial supply`);
  }

  logger.info('✅ Parameter validation completed');
}

/**
 * Create a mint with Metaplex metadata using UMI
 */
async function createMintWithMetaplex(
  params: CreateMintParams,
  rpcUrl: string,
  command: Command
): Promise<void> {
  try {
    logger.info('🎨 Creating mint with Metaplex metadata...');

    // Set up UMI with noop signer for instruction building
    const tokenProgramId =
      params.tokenProgram === 'token-2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

    // Generate deterministic mint address using createAccountWithSeed
    const seed = `mint_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const mintAddress = await PublicKey.createWithSeed(params.authority, seed, tokenProgramId);

    const umi = createUmi(rpcUrl)
      .use(mplTokenMetadata())
      .use(mplToolbox())
      .use(signerIdentity(createNoopSigner(umiPk(params.authority.toBase58()))));

    // Create UMI public key from our deterministic address
    const umiMintPk = umiPk(mintAddress.toBase58());

    logger.info(`📋 Generated mint address: ${mintAddress.toBase58()}`);
    logger.info(`📋 Mint seed: ${seed}`);
    logger.info(`📋 Using token program: ${tokenProgramId.toBase58()}`);

    // Step 1: Create the mint account using SPL Token instructions (deterministic)
    const connection = new Connection(rpcUrl);
    const builder = new SplInstructionBuilder(tokenProgramId);

    const createMintInstructions = await builder.createMintWithSeed(
      mintAddress,
      params.authority,
      seed,
      params.authority, // freeze authority = mint authority
      params.decimals,
      connection
    );

    // Step 2: Create Metaplex metadata instruction separately
    const [metadataPda] = findMetadataPda(umi, { mint: umiMintPk });

    // Use UMI's createV1 but only extract the metadata instruction
    const metadataBuilder = createV1(umi, {
      mint: umiMintPk,
      authority: umi.identity,
      name: params.name!,
      symbol: params.symbol!,
      uri: params.uri!,
      sellerFeeBasisPoints: percentAmount(0),
      decimals: params.decimals,
      splTokenProgram: umiPk(tokenProgramId.toBase58()),
      tokenStandard: TokenStandard.Fungible,
    });

    // Get only the metadata instruction (skip mint creation)
    const allInstructions = metadataBuilder.getInstructions();

    // Find the metadata instruction (usually the last one)
    const lastInstruction = allInstructions[allInstructions.length - 1];
    if (!lastInstruction) {
      throw new Error('No metadata instruction generated');
    }
    const metadataInstruction = toWeb3JsInstruction(lastInstruction);

    const instructions: TransactionInstruction[] = [...createMintInstructions, metadataInstruction];

    logger.info(`📋 Generated ${instructions.length} instructions for mint + metadata creation`);

    // Handle initial supply if specified
    if (params.initialSupply && params.initialSupply > 0) {
      logger.info('💰 Adding initial supply mint instructions...');

      // Calculate ATA for recipient
      const recipientAta = findAssociatedTokenAddress(
        mintAddress,
        params.recipient!,
        tokenProgramId
      );

      logger.info(`📋 Creating ATA for recipient: ${recipientAta.toBase58()}`);

      // Always create ATA instruction (it will fail gracefully if it already exists)
      const createAtaIx = builder.createAssociatedTokenAccountWithAddress(
        params.authority,
        recipientAta,
        params.recipient!,
        mintAddress
      );
      instructions.push(createAtaIx);

      // Add mint instruction using SPL Token builder
      const mintToIx = builder.mintTo(
        mintAddress,
        recipientAta,
        params.authority,
        params.initialSupply
      );
      instructions.push(mintToIx);

      logger.info(
        `📋 Will mint ${params.initialSupply.toString()} smallest units to ${recipientAta.toBase58()}`
      );
    }

    // Build transaction
    const tb = new TransactionBuilder({ rpcUrl });
    logger.info('🔄 Building and simulating transaction...');

    logger.info(`📋 Metadata PDA: ${metadataPda}`);

    await finalizeTransaction({
      txBuilder: tb,
      instructions,
      payer: params.authority,
      instructionName: 'spl-token.create_mint_with_metaplex',
      command,
    });

    logger.info('✅ Transaction simulation completed');
  } catch (error) {
    logger.error('❌ Failed to create mint with Metaplex metadata');
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    console.error('❌ Failed to create mint with Metaplex metadata.');
    console.error('💡 Check your parameters and RPC connection.');
    process.exit(1);
  }
}

/**
 * Create a plain mint without metadata
 */
async function createPlainMint(
  params: CreateMintParams,
  connection: Connection,
  rpcUrl: string,
  command: Command
): Promise<void> {
  try {
    logger.info('🪙 Creating plain mint (no metadata)...');

    const tokenProgramId =
      params.tokenProgram === 'token-2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    logger.info(`📋 Using token program: ${tokenProgramId.toBase58()}`);

    // Generate deterministic mint address using createAccountWithSeed
    const seed = `mint_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const mintAddress = await PublicKey.createWithSeed(params.authority, seed, tokenProgramId);
    logger.info(`📋 Generated mint address: ${mintAddress.toBase58()}`);
    logger.info(`📋 Mint seed: ${seed}`);

    const builder = new SplInstructionBuilder(tokenProgramId);
    const instructions: TransactionInstruction[] = [];

    // Create mint account and initialize
    const createMintInstructions = await builder.createMintWithSeed(
      mintAddress,
      params.authority,
      seed,
      params.authority, // freeze authority = mint authority
      params.decimals,
      connection
    );
    instructions.push(...createMintInstructions);

    // Handle initial supply if specified
    if (params.initialSupply && params.initialSupply > 0) {
      logger.info('💰 Adding initial supply mint instructions...');

      logger.debug(`🔧 Mint address: ${mintAddress.toBase58()}`);
      logger.debug(`🔧 Recipient: ${params.recipient!.toBase58()}`);
      logger.debug(`🔧 Token program: ${tokenProgramId.toBase58()}`);

      // Create ATA and mint instructions - let the builder handle ATA address calculation
      logger.info(`📋 Creating ATA and mint instructions for initial supply`);

      try {
        // Calculate ATA address manually to avoid validation issues
        const recipientAta = findAssociatedTokenAddress(
          mintAddress,
          params.recipient!,
          tokenProgramId
        );

        // Create ATA instruction
        const createAtaIx = builder.createAssociatedTokenAccountWithAddress(
          params.authority,
          recipientAta,
          params.recipient!,
          mintAddress
        );
        instructions.push(createAtaIx);

        // Add mint to instruction
        const mintToIx = builder.mintTo(
          mintAddress,
          recipientAta,
          params.authority,
          params.initialSupply
        );
        instructions.push(mintToIx);

        logger.info(`📋 Will mint ${params.initialSupply.toString()} smallest units to ATA`);
      } catch (error) {
        logger.error(`❌ Failed to create initial supply instructions: ${error}`);
        throw error;
      }
    }

    // Build transaction
    const tb = new TransactionBuilder({ rpcUrl });
    logger.info('🔄 Building and simulating transaction...');

    await finalizeTransaction({
      txBuilder: tb,
      instructions,
      payer: params.authority,
      instructionName: 'spl-token.create_mint',
      command,
    });

    logger.info('✅ Transaction simulation completed');
  } catch (error) {
    logger.error('❌ Failed to create plain mint');
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    console.error('❌ Failed to create plain mint.');
    console.error('💡 Check your parameters and RPC connection.');
    process.exit(1);
  }
}
