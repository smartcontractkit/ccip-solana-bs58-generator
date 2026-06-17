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

        // Extract account information
        const accounts = allInstructions[0]?.keys || [];
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
            programId: allInstructions[0]?.programId.toString() || '',
            instructionData: allInstructions[0]?.data.toString('hex') || '',
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
      const simulation = await this.connection.simulateTransaction(transaction, {
        commitment: DEFAULT_TRANSACTION_CONFIG.COMMITMENT,
      });

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
