import {
  Connection,
  Keypair,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
  PublicKey,
} from '@solana/web3.js';
import bs58 from 'bs58';
import type { GeneratedTransaction, TransactionOptions } from '../types/index.js';
import { logger, logTiming } from '../utils/logger.js';
import { DEFAULT_TRANSACTION_CONFIG } from '../utils/constants.js';

/**
 * Generic transaction builder that can work with any Solana instructions
 */
/** Anchor's AccountNotInitialized. */
const ANCHOR_ACCOUNT_NOT_INITIALIZED = 3012;
export const ACCOUNT_LAG_RETRIES = 3;
export const ACCOUNT_LAG_RETRY_DELAY_MS = 400;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * True when a failed simulation looks like the RPC node lagging behind a just-created account
 * rather than a genuinely missing one: Anchor raises AccountNotInitialized (3012) when it cannot
 * deserialize an account the instruction requires.
 *
 * Retrying is only safe because a wrong PDA derivation produces the same error and still fails
 * after the retries are exhausted - the retry delays that report, it does not hide it.
 */
export function isAccountNotInitialized(value: { err?: unknown; logs?: string[] | null }): boolean {
  if (!value.err) return false;
  const err = JSON.stringify(value.err);
  if (err.includes(`"Custom":${ANCHOR_ACCOUNT_NOT_INITIALIZED}`)) return true;
  return (value.logs ?? []).some(l => l.includes('AccountNotInitialized'));
}

/**
 * The same condition seen from the send path, where it arrives as a thrown SendTransactionError
 * whose message carries the preflight logs.
 */
export function isAccountNotInitializedError(message: string): boolean {
  return (
    message.includes('AccountNotInitialized') ||
    message.includes(`Error Number: ${ANCHOR_ACCOUNT_NOT_INITIALIZED}`) ||
    message.includes('custom program error: 0xbc4')
  );
}

export class TransactionBuilder {
  private connection: Connection;
  private options: { rpcUrl: string };

  constructor(options: TransactionOptions) {
    this.options = {
      rpcUrl: options.rpcUrl,
    };

    this.connection = new Connection(this.options.rpcUrl, {
      commitment: DEFAULT_TRANSACTION_CONFIG.COMMITMENT,
    });

    logger.debug(
      {
        rpcUrl: this.options.rpcUrl,
      },
      'TransactionBuilder initialized'
    );
  }

  /**
   * Build a transaction from instructions
   */
  async buildTransaction(
    instructions: TransactionInstruction[],
    payer: PublicKey,
    instructionName?: string
  ): Promise<GeneratedTransaction> {
    return logTiming(
      logger,
      `buildTransaction${instructionName ? ` (${instructionName})` : ''}`,
      async () => {
        logger.debug(
          {
            instructionCount: instructions.length,
            payer: payer.toString(),
            instructionName,
          },
          'Building transaction'
        );

        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
        logger.debug({ blockhash, lastValidBlockHeight }, 'Retrieved blockhash');

        const allInstructions = [...instructions];

        // Create transaction message
        const transactionMessage = new TransactionMessage({
          payerKey: payer,
          recentBlockhash: blockhash,
          instructions: allInstructions,
        });

        // Use legacy message format for compatibility with Squads multisig
        const legacyMessage = transactionMessage.compileToLegacyMessage();

        // Serialize and encode transaction
        const serializedTransaction = legacyMessage.serialize();
        const transactionSizeBytes = serializedTransaction.length;
        const base58Encoded = bs58.encode(serializedTransaction);
        const base64Encoded = Buffer.from(serializedTransaction).toString('base64');
        const hexEncoded = Buffer.from(serializedTransaction).toString('hex');

        // Report the accounts of the COMPILED MESSAGE, not of the first instruction.
        //
        // Some commands build several instructions (`create-multisig` is [create, init]), so
        // `instructions[0].keys` described a fraction of the transaction: 2 of create-multisig's 6
        // accounts, dropping the pool signer PDA that makes the mint authority safe. A reviewer
        // approving in Squads was checking the wrong list.
        const accounts = legacyMessage.accountKeys.map((pubkey, index) => ({
          pubkey,
          isSigner: legacyMessage.isAccountSigner(index),
          isWritable: legacyMessage.isAccountWritable(index),
        }));
        const signers = accounts.filter(acc => acc.isSigner).map(acc => acc.pubkey);
        const writableAccounts = accounts.filter(acc => acc.isWritable).map(acc => acc.pubkey);
        const readOnlyAccounts = accounts
          .filter(acc => !acc.isWritable && !acc.isSigner)
          .map(acc => acc.pubkey);

        // Create a versioned transaction for simulation (but use legacy for final output)
        const versionedTransactionForSim = new VersionedTransaction(
          transactionMessage.compileToV0Message()
        );

        // Simulate transaction to get compute units
        const simulationResult = await this.simulateTransaction(versionedTransactionForSim);
        const computeUnits = simulationResult.unitsConsumed || 0;

        const result: GeneratedTransaction = {
          instruction: instructionName || 'unknown',
          base58: base58Encoded,
          base64: base64Encoded,
          hex: hexEncoded,
          accounts: accounts.map((account, index) => ({
            index,
            pubkey: account.pubkey.toString(),
            isSigner: account.isSigner,
            isWritable: account.isWritable,
          })),
          details: {
            // First instruction only, kept for compatibility; `instructions` below has all of them.
            programId: allInstructions[0]?.programId.toString() || '',
            instructionData: allInstructions[0]?.data.toString('hex') || '',
            instructions: allInstructions.map(ix => ({
              programId: ix.programId.toString(),
              data: ix.data.toString('hex'),
              accounts: ix.keys.map(k => ({
                pubkey: k.pubkey.toString(),
                isSigner: k.isSigner,
                isWritable: k.isWritable,
              })),
            })),
            signers: signers.map(signer => signer.toString()),
            writableAccounts: writableAccounts.map(acc => acc.toString()),
            readOnlyAccounts: readOnlyAccounts.map(acc => acc.toString()),
            feePayer: payer.toString(),
            accountSummary: {
              total: accounts.length,
              signers: accounts.filter(acc => acc.isSigner).length,
              writable: accounts.filter(acc => acc.isWritable).length,
              readOnly: accounts.filter(acc => !acc.isWritable && !acc.isSigner).length,
            },
          },
          metadata: {
            generatedAt: new Date().toISOString(),
            computeUnits,
            simulationSuccess: simulationResult.success,
            ...(simulationResult.error !== undefined
              ? { simulationError: simulationResult.error }
              : {}),
          },
        };

        logger.info(
          {
            instructionName,
            transactionSize: `${transactionSizeBytes} bytes`,
            base58Length: `${base58Encoded.length} characters`,
            base64Length: `${base64Encoded.length} characters`,
            hexLength: `${hexEncoded.length} characters`,
            accountCount: accounts.length,
            signerCount: signers.length,
            computeUnits: Math.floor(computeUnits),
          },
          'Transaction built successfully'
        );

        return result;
      }
    );
  }

  /**
   * Build a single instruction transaction (convenience method)
   */
  async buildSingleInstructionTransaction(
    instruction: TransactionInstruction,
    payer: PublicKey,
    instructionName?: string
  ): Promise<GeneratedTransaction> {
    return this.buildTransaction([instruction], payer, instructionName);
  }

  /**
   * Simulate a SIGNED transaction with signature verification enabled.
   *
   * Used only in --execute mode: it signs a v0 message with the provided keypair and runs
   * `simulateTransaction({ sigVerify: true })`, so a transaction that still has a required signer the
   * local keypair did not provide fails fast and clearly instead of later at send time. This triggers
   * only when an instruction marks a signer that is NOT our keypair — e.g. an SPL multisig whose
   * threshold needs a co-signer we don't control, or extra signer accounts mistakenly listed in
   * `--multisig-signers`. A 1-of-N multisig where we pass only our own member key signs fully and
   * passes. Verifying the signer set is blockhash-independent, so fetching a fresh blockhash here is
   * fine even though the executor fetches its own at send.
   */
  async simulateSignedTransaction(
    instructions: TransactionInstruction[],
    payer: PublicKey,
    signer: Keypair
  ): Promise<{ success: boolean; error?: string; logs?: string[] }> {
    const { blockhash } = await this.connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const signedTx = new VersionedTransaction(message);
    signedTx.sign([signer]);

    const simulation = await this.connection.simulateTransaction(signedTx, {
      sigVerify: true,
      commitment: DEFAULT_TRANSACTION_CONFIG.COMMITMENT,
    });

    if (simulation.value.err) {
      return {
        success: false,
        error: JSON.stringify(simulation.value.err),
        logs: simulation.value.logs || [],
      };
    }

    return { success: true, logs: simulation.value.logs || [] };
  }

  /**
   * Simulate transaction to estimate compute units and validate
   */
  private async simulateTransaction(transaction: VersionedTransaction): Promise<{
    success: boolean;
    error?: string;
    logs?: string[];
    unitsConsumed?: number;
  }> {
    try {
      logger.debug('Simulating transaction');
      let simulation = await this.connection.simulateTransaction(transaction, {
        commitment: DEFAULT_TRANSACTION_CONFIG.COMMITMENT,
      });

      // A load-balanced RPC can route this simulation to a node that has not yet replayed the slot
      // in which a just-created account appeared, so the program sees no account and Anchor raises
      // AccountNotInitialized. The account does exist; retry before reporting it as missing.
      for (
        let attempt = 1;
        attempt <= ACCOUNT_LAG_RETRIES && isAccountNotInitialized(simulation.value);
        attempt++
      ) {
        logger.warn(
          { attempt, of: ACCOUNT_LAG_RETRIES },
          'Simulation reported an uninitialized account; the RPC node may be behind, retrying'
        );
        await sleep(ACCOUNT_LAG_RETRY_DELAY_MS * attempt);
        simulation = await this.connection.simulateTransaction(transaction, {
          commitment: DEFAULT_TRANSACTION_CONFIG.COMMITMENT,
        });
      }

      if (simulation.value.err) {
        logger.warn(
          {
            error: simulation.value.err,
            logs: simulation.value.logs,
          },
          'Transaction simulation failed'
        );

        return {
          success: false,
          error: JSON.stringify(simulation.value.err),
          logs: simulation.value.logs || [],
        };
      }

      logger.debug(
        {
          unitsConsumed: simulation.value.unitsConsumed,
          logs: simulation.value.logs,
        },
        'Transaction simulation successful'
      );

      const result: {
        success: boolean;
        error?: string;
        logs?: string[];
        unitsConsumed?: number;
      } = {
        success: true,
        logs: simulation.value.logs || [],
      };

      if (simulation.value.unitsConsumed !== undefined) {
        result.unitsConsumed = simulation.value.unitsConsumed;
      }

      return result;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Transaction simulation error'
      );
      if (error instanceof Error && error.stack) {
        logger.error({ stack: error.stack }, 'Stack trace');
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
