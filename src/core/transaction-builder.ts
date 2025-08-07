import {
  Connection,
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

        const versionedTransaction = new VersionedTransaction(
          transactionMessage.compileToV0Message()
        );

        // Serialize and encode transaction
        const serializedTransaction = versionedTransaction.serialize();
        const base58Encoded = bs58.encode(serializedTransaction);
        const hexEncoded = Buffer.from(serializedTransaction).toString('hex');

        // Extract account information
        const accounts = allInstructions[0]?.keys || [];
        const signers = accounts.filter(acc => acc.isSigner).map(acc => acc.pubkey);
        const writableAccounts = accounts.filter(acc => acc.isWritable).map(acc => acc.pubkey);
        const readOnlyAccounts = accounts
          .filter(acc => !acc.isWritable && !acc.isSigner)
          .map(acc => acc.pubkey);

        // Simulate transaction to get compute units
        const simulationResult = await this.simulateTransaction(versionedTransaction);
        const computeUnits = simulationResult.unitsConsumed || 0;

        const result: GeneratedTransaction = {
          instruction: instructionName || 'unknown',
          base58: base58Encoded,
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
          },
        };

        logger.info(
          {
            instructionName,
            base58Length: base58Encoded.length,
            hexLength: hexEncoded.length,
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

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
