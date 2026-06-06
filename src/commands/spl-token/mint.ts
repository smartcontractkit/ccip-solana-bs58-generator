import { Command } from 'commander';
import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { getAccount, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { detectTokenProgramId } from '../../utils/token.js';
import { SplMintArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { finalizeTransaction } from '../../utils/finalize-transaction.js';
import { logger } from '../../utils/logger.js';
import { InstructionBuilder as SplInstructionBuilder } from '../../programs/spl-token/instructions.js';

/**
 * Calculate ATA address without curve validation (for instruction building)
 */
function findAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
  tokenProgramId: PublicKey
): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgramId.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

export async function mintCommand(options: Record<string, string>, command: Command) {
  try {
    const global = command.parent?.opts() || {};
    const parsed = validateArgs(SplMintArgsSchema, {
      authority: options.authority,
      mint: options.mint,
      recipient: options.recipient,
      amount: options.amount,
      multisig: options.multisig,
      multisigSigners: options.multisigSigners,
      rpcUrl: global.resolvedRpcUrl,
    });
    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      process.exit(1);
    }
    const rpcUrl = parsed.data.rpcUrl ?? (global.resolvedRpcUrl as string);

    const connection = new Connection(rpcUrl);
    const authority = parsed.data.authority;
    const mint = parsed.data.mint;
    const recipient = parsed.data.recipient;
    const amount = parsed.data.amount;

    // Detect token program on-chain (unless overridden)
    const detectedProgram = await detectTokenProgramId(connection, mint);
    const tokenProgramId = detectedProgram;

    // Compute ATA; do NOT create on-chain, only warn if missing
    const recipientAta = findAssociatedTokenAddress(mint, recipient, tokenProgramId);

    let ataExists = false;
    try {
      await getAccount(connection, recipientAta, 'confirmed', tokenProgramId);
      ataExists = true;
    } catch {
      ataExists = false;
    }

    if (!ataExists) {
      logger.warn(
        {
          recipient: recipient.toBase58(),
          recipientAta: recipientAta.toBase58(),
          tokenProgramId: tokenProgramId.toBase58(),
        },
        'Recipient ATA does not exist. Mint will fail if the token account is missing.'
      );
    }

    // Support mint with or without SPL token multisig
    let mintAuthority: PublicKey;
    let additionalSigners: PublicKey[] = [];
    if (parsed.data.multisig) {
      mintAuthority = parsed.data.multisig;
      additionalSigners = parsed.data.multisigSigners ?? [];
    } else {
      mintAuthority = authority;
    }

    const splIxBuilder = new SplInstructionBuilder(tokenProgramId);
    const ixs: TransactionInstruction[] = [
      splIxBuilder.mintTo(mint, recipientAta, mintAuthority, amount, additionalSigners),
    ];

    const tb = new TransactionBuilder({ rpcUrl });
    logger.info('🔄 Building and simulating transaction...');
    await finalizeTransaction({
      txBuilder: tb,
      instructions: ixs,
      payer: authority,
      instructionName: 'spl.mint',
      command,
    });
    logger.info('✅ Transaction simulation completed');
  } catch (error) {
    logger.error('❌ Failed to mint tokens');
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    console.error('❌ Failed to mint tokens.');
    console.error('💡 Check your parameters, multisig configuration, and RPC connection.');
    process.exit(1);
  }
}
