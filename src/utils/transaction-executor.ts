import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  SendOptions,
} from '@solana/web3.js';
import { DEFAULT_TRANSACTION_CONFIG } from './constants.js';
import { logger } from './logger.js';
import { isAccountNotInitializedError } from '../core/transaction-builder.js';
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
  //
  // 'finalized' is deliberate, and not about slow RPCs. A 'confirmed' blockhash can come from a
  // fork that is later abandoned, and this transaction is signed once with no re-sign path, so
  // that would leave bytes the network never accepts. The cost is ~31 slots off the blockhash's
  // 150-block validity window; if expiry under congestion shows up, this is the knob to turn.
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
  logger.debug({ blockhash, lastValidBlockHeight }, 'Building and signing transaction');

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = feePayer.publicKey;
  tx.add(...instructions);
  tx.sign(...signers);
  const rawTransaction = tx.serialize();

  // A send whose preflight reports AccountNotInitialized is usually an RPC node that has not
  // replayed the slot in which a just-created account appeared - the build-time simulation can pass
  // on one node while the send lands on another that is behind. Three attempts over ~3s is not
  // enough for that; give this specific case a longer budget, bounded well inside the blockhash
  // lifetime. A wrong derivation produces the same error and still fails once the budget is spent.
  const maxRetries = 3;
  const maxLagRetries = 8;
  let lastError: Error | null = null;
  let budget = maxRetries;

  for (let attempt = 1; attempt <= budget; attempt++) {
    try {
      logger.debug({ attempt, maxRetries }, 'Sending signed transaction');

      // Re-broadcasting the same signed transaction is idempotent (identical signature), so a retry
      // after a confirmation timeout cannot double-execute the instructions.
      // preflightCommitment is set explicitly: left unset, web3.js falls back to the connection's
      // commitment, and a connection built without one preflights at 'finalized' - a different bank
      // from the one the build-time simulation used. See utils/connection.ts.
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: DEFAULT_TRANSACTION_CONFIG.COMMITMENT,
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

      const lagShaped = isAccountNotInitializedError(lastError.message);
      if (lagShaped && budget === maxRetries) {
        budget = maxLagRetries;
        logger.warn(
          { budget },
          'Preflight reports an uninitialized account; the RPC node may be behind, extending retries'
        );
      }

      logger.warn(
        {
          attempt,
          maxRetries: budget,
          error: lastError.message,
        },
        'Transaction attempt failed'
      );

      // Don't retry if we've exhausted attempts
      if (attempt === budget) {
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

  logger.error({ maxRetries: budget, error: errorMessage }, 'Transaction execution failed');
  throw new Error(errorMessage);
}
