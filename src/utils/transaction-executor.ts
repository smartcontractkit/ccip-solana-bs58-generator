import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  SendOptions,
} from '@solana/web3.js';
import { logger } from './logger.js';
import fs from 'fs';

/**
 * Load keypair from filesystem
 * Supports standard Solana CLI keypair format (JSON array of numbers)
 *
 * @param path - Path to keypair file
 * @returns Loaded keypair
 * @throws Error if file cannot be read or parsed
 */
export function loadKeypair(path: string): Keypair {
  try {
    const keypairData = JSON.parse(fs.readFileSync(path, 'utf-8'));

    if (!Array.isArray(keypairData)) {
      throw new Error('Keypair file must contain a JSON array');
    }

    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load keypair from ${path}: ${message}`);
  }
}

/**
 * Execute a set of instructions as a single transaction
 *
 * @param connection - Solana RPC connection
 * @param instructions - Transaction instructions to execute
 * @param signers - Keypairs that will sign the transaction
 * @param options - Optional send transaction options
 * @returns Transaction signature
 */
export async function executeTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  signers: Keypair[],
  options?: SendOptions
): Promise<string> {
  if (signers.length === 0) {
    throw new Error('At least one signer is required');
  }

  logger.debug(
    {
      instructionCount: instructions.length,
      signerCount: signers.length,
    },
    'Preparing to execute transaction'
  );

  // Get recent blockhash and last valid block height
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  // Build transaction with blockhash
  const feePayer = signers[0];
  if (!feePayer) {
    throw new Error('First signer is required as fee payer');
  }

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = feePayer.publicKey;
  tx.add(...instructions);

  // Sign transaction with all signers
  tx.sign(...signers);

  logger.debug('Sending signed transaction');
  const rawTransaction = tx.serialize();
  const signature = await connection.sendRawTransaction(rawTransaction, options);

  logger.debug({ signature, lastValidBlockHeight }, 'Transaction sent, confirming...');

  // Use modern confirmation strategy
  await connection.confirmTransaction(
    {
      signature,
      blockhash,
      lastValidBlockHeight,
    },
    'confirmed'
  );

  logger.info({ signature }, 'Transaction confirmed successfully');
  return signature;
}
