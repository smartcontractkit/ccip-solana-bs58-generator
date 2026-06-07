import type { GeneratedTransaction } from '../types/index.js';
import { logger } from './logger.js';
import { getTransactionExplorerUrl } from './explorer.js';
import type { SolanaEnvironment } from './constants.js';

/**
 * Utility for displaying transaction data with beautiful formatting
 */
export class TransactionDisplay {
  /**
   * Display transaction results in a user-friendly format
   * @param transaction The generated transaction
   * @param instructionName The instruction name for context
   */
  static displayResults(transaction: GeneratedTransaction, instructionName: string): void {
    logger.info('');
    logger.info('🎉 Transaction generated successfully!');
    logger.info('');

    // Transaction details section
    logger.info('📋 Transaction Details:');
    logger.info(`   Instruction: ${instructionName}`);
    logger.info(`   Size: ${Math.floor(transaction.hex.length / 2)} bytes`);
    logger.info(`   Base58 length: ${transaction.base58.length} characters`);
    logger.info(
      `   Compute units: ${transaction.metadata.computeUnits?.toLocaleString() || 'Unknown'}`
    );
    logger.info(`   Generated: ${transaction.metadata.generatedAt}`);
    logger.info('');

    // Base58 transaction data - highlighted for easy copy/paste
    this.displayBase58Transaction(transaction.base58);
    logger.info('');

    // Account information
    this.displayAccountInfo(transaction);

    // Usage instructions
    this.displayUsageInstructions();

    // Final notes
    this.displayNotes(transaction);
  }

  /**
   * Display Base58 transaction data in a beautiful, copy-friendly format
   * Note: Uses console.log for clean copy-paste experience (no timestamps)
   */
  private static displayBase58Transaction(base58: string): void {
    logger.info('🔗 Transaction Data (Base58):');
    logger.info('');

    // Clean, simple approach - just highlight and the raw Base58
    console.log('🎯 COPY TRANSACTION DATA BELOW:');
    console.log('');
    console.log(base58);
    console.log('');
    console.log('─'.repeat(Math.min(80, base58.length)));

    logger.info('💡 Triple-click the line above to select the entire transaction data');
  }

  /**
   * Display account information in a formatted table
   */
  private static displayAccountInfo(transaction: GeneratedTransaction): void {
    logger.info('📊 Account Information:');
    logger.info(`   Total accounts: ${transaction.accounts.length}`);

    transaction.accounts.forEach((account, index) => {
      const accountNumber = (index + 1).toString().padStart(2, ' ');
      const accountType = this.getAccountTypeDisplay(account);
      logger.info(`   ${accountNumber}. ${account.pubkey} ${accountType}`);
    });
    logger.info('');
  }

  /**
   * Get formatted account type display
   */
  private static getAccountTypeDisplay(account: {
    isSigner: boolean;
    isWritable: boolean;
  }): string {
    const parts = [];
    if (account.isSigner) parts.push('signer');
    if (account.isWritable) parts.push('writable');
    if (parts.length === 0) parts.push('read-only');

    return `(${parts.join(', ')})`;
  }

  /**
   * Display usage instructions
   */
  private static displayUsageInstructions(): void {
    logger.info('💡 Usage Instructions:');
    logger.info('   1. 📋 Copy the Base58 transaction data from the box above');
    logger.info('   2. 🔗 Open your Squads multisig interface');
    logger.info('   3. ➕ Create a "Custom Transaction" or "Raw Transaction"');
    logger.info('   4. 📝 Paste the Base58 data into the transaction field');
    logger.info('   5. ✅ Review all accounts and parameters carefully');
    logger.info('   6. 👥 Get required signatures from multisig members');
    logger.info('   7. 🚀 Execute the transaction on Solana');
    logger.info('');
  }

  /**
   * Display important notes and warnings
   */
  private static displayNotes(transaction: GeneratedTransaction): void {
    logger.info('🔍 Important Notes:');
    logger.info('   • Transaction was simulated and validated before generation');
    logger.info('   • All public keys and accounts have been verified');
    logger.info('   • Always double-check the transaction details in your multisig');

    if (transaction.metadata.computeUnits && transaction.metadata.computeUnits > 0) {
      logger.info(
        `   • Estimated compute units: ${transaction.metadata.computeUnits.toLocaleString()}`
      );
    }

    logger.info('   • This transaction is valid until the blockhash expires (~2 minutes)');
    logger.info('');
  }

  /**
   * Display a loud banner before signing & sending in --execute mode, so it is never
   * ambiguous that a real, irreversible transaction is about to be sent and by whom.
   */
  static displayExecutionBanner(params: {
    signer: string;
    instructionName: string;
    env?: SolanaEnvironment | undefined;
    rpcUrl: string;
  }): void {
    const envLabel = params.env ?? 'custom RPC';
    logger.info('');
    if (params.env === 'mainnet') {
      logger.warn('🚨🚨🚨 MAINNET EXECUTION — this is REAL and IRREVERSIBLE 🚨🚨🚨');
    }
    logger.info(`🖊️  EXECUTE MODE — signing & sending on ${envLabel}`);
    logger.info(`   Signer:      ${params.signer}`);
    logger.info(`   Instruction: ${params.instructionName}`);
    logger.info(`   RPC:         ${params.rpcUrl}`);
    logger.info('');
  }

  /**
   * Display on-chain execution results (no Base58 output)
   */
  static displayExecutionResults(
    signature: string,
    instructionName: string,
    env?: SolanaEnvironment
  ): void {
    logger.info('');
    logger.info('🎉 Transaction executed successfully!');
    logger.info('');
    logger.info('📋 Execution Details:');
    logger.info(`   Instruction: ${instructionName}`);
    logger.info(`   Signature:   ${signature}`);
    if (env) {
      // Known cluster → clean explorer link (no RPC URL embedded, so no API-key leakage).
      logger.info(`   Explorer:    ${getTransactionExplorerUrl(signature, env)}`);
    } else {
      // Custom/local RPC — the public explorer can't reliably reach it, and we must not embed the
      // (possibly secret-bearing) RPC URL. Surface the signature for the user to look up themselves.
      logger.info(
        '   Explorer:    custom/local RPC — look up the signature above in your explorer'
      );
    }
    logger.info('');
  }

  /**
   * Display a simple success message for non-transaction operations
   */
  static displaySuccess(message: string): void {
    logger.info('');
    logger.info(`✅ ${message}`);
    logger.info('');
  }

  /**
   * Display an error with helpful formatting
   */
  static displayError(error: string, suggestions?: string[]): void {
    logger.error('');
    logger.error(`❌ Error: ${error}`);

    if (suggestions && suggestions.length > 0) {
      logger.error('');
      logger.error('💡 Suggestions:');
      suggestions.forEach(suggestion => {
        logger.error(`   • ${suggestion}`);
      });
    }

    logger.error('');
  }

  /**
   * Display a warning with helpful formatting
   */
  static displayWarning(warning: string, details?: string[]): void {
    logger.warn('');
    logger.warn(`⚠️  Warning: ${warning}`);

    if (details && details.length > 0) {
      logger.warn('');
      details.forEach(detail => {
        logger.warn(`   • ${detail}`);
      });
    }

    logger.warn('');
  }
}
