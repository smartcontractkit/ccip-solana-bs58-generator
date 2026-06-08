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
 *
 * The transaction is built and signed exactly ONCE, before the retry loop. Retries only
 * re-broadcast that same signed transaction — because the signature is identical, the network
 * de-duplicates it, so a retry (e.g. after a confirmation timeout where the first send already
 * landed) can never execute the instructions twice. Re-signing with a fresh blockhash would create
 * a new signature and risk double execution (e.g. a double mint), which is exactly what we avoid.
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

  // Build and sign ONCE so every retry re-broadcasts an identical signature (see note above).
  // Use 'finalized' commitment for a more reliable blockhash on slow RPCs.
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
  logger.debug({ blockhash, lastValidBlockHeight }, 'Building and signing transaction');

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = feePayer.publicKey;
  tx.add(...instructions);
  tx.sign(...signers);
  const rawTransaction = tx.serialize();

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug({ attempt, maxRetries }, 'Sending signed transaction');

      // Re-broadcasting the same signed transaction is idempotent (identical signature), so a retry
      // after a confirmation timeout cannot double-execute the instructions.
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
