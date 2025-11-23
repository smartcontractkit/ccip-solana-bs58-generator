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
 * Uses 'finalized' commitment for blockhash to reduce expiration issues on slow/congested RPCs.
 * Implements automatic retry logic for transient RPC failures.
 *
 * @param connection - Solana RPC connection
 * @param instructions - Transaction instructions to execute
 * @param signers - Keypairs that will sign the transaction
 * @param options - Optional send transaction options
 * @returns Transaction signature
 * @throws Error if transaction fails after retries
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

  const feePayer = signers[0];
  if (!feePayer) {
    throw new Error('First signer is required as fee payer');
  }

  logger.debug(
    {
      instructionCount: instructions.length,
      signerCount: signers.length,
    },
    'Preparing to execute transaction'
  );

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug({ attempt, maxRetries }, 'Fetching latest blockhash');

      // Use 'finalized' commitment for more reliable blockhash on slow RPCs
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

      logger.debug({ blockhash, lastValidBlockHeight }, 'Building transaction');

      // Build and sign transaction
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = feePayer.publicKey;
      tx.add(...instructions);
      tx.sign(...signers);

      logger.debug({ attempt }, 'Sending signed transaction');

      // Send with preflight checks and retries
      const rawTransaction = tx.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        maxRetries: 2,
        ...options,
      });

      logger.debug({ signature, lastValidBlockHeight }, 'Transaction sent, confirming...');

      // Confirm transaction
      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      );

      logger.info({ signature, attempt }, 'Transaction confirmed successfully');
      return signature;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.warn(
        {
          attempt,
          maxRetries,
          error: lastError.message,
        },
        'Transaction attempt failed'
      );

      // Don't retry if we've exhausted attempts
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying (exponential backoff)
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      logger.debug({ delayMs }, 'Waiting before retry');
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // All retries exhausted
  const errorMessage = lastError ? lastError.message : 'Transaction failed after maximum retries';

  logger.error({ maxRetries, error: errorMessage }, 'Transaction execution failed');
  throw new Error(errorMessage);
}
