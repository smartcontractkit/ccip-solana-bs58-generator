import { Command } from 'commander';
import { Connection } from '@solana/web3.js';
import { validateArgs } from '../../utils/validation.js';
import { RouterAppendToLookupTableArgsSchema } from '../../types/index.js';
import { TransactionDisplay } from '../../utils/display.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { buildAppendToAlt } from '../../utils/alt.js';
import { createChildLogger, logger } from '../../utils/logger.js';

export async function appendToLookupTableCommand(
  options: Record<string, string>,
  command: Command
): Promise<void> {
  const cmdLogger = createChildLogger(logger, { command: 'router.append-to-lookup-table' });

  try {
    const parent = command.parent!;
    const globalOptions = parent.opts();

    const parsed = validateArgs(RouterAppendToLookupTableArgsSchema, {
      lookupTableAddress: options.lookupTableAddress,
      authority: options.authority,
      additionalAddresses: options.additionalAddresses,
      rpcUrl: globalOptions.resolvedRpcUrl,
    });

    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      process.exit(1);
    }

    const rpcUrl = parsed.data.rpcUrl ?? globalOptions.resolvedRpcUrl!;
    cmdLogger.info('🔄 Generating append_to_lookup_table transaction...');

    const connection = new Connection(rpcUrl);

    // Log current state for transparency
    cmdLogger.debug(
      {
        lookupTableAddress: parsed.data.lookupTableAddress.toBase58(),
        authority: parsed.data.authority.toBase58(),
        addressesToAdd: parsed.data.additionalAddresses.length,
      },
      'Appending addresses to existing ALT'
    );

    const { instructions, totalAddressesAfterAppend } = await buildAppendToAlt({
      connection,
      authority: parsed.data.authority,
      lookupTableAddress: parsed.data.lookupTableAddress,
      additionalAddresses: parsed.data.additionalAddresses,
    });

    const txBuilder = new TransactionBuilder({ rpcUrl });
    cmdLogger.info('🔄 Building and simulating transaction...');

    const generated = await txBuilder.buildTransaction(
      instructions,
      parsed.data.authority,
      'router.append_to_lookup_table'
    );

    // Display success info before transaction details
    console.log(`📮 Lookup Table Address: ${parsed.data.lookupTableAddress.toBase58()}`);
    console.log(`📊 Addresses added: ${parsed.data.additionalAddresses.length}`);
    console.log(`📈 Total addresses after append: ${totalAddressesAfterAppend}`);
    console.log('   ✅ Transaction simulation completed');

    TransactionDisplay.displayResults(generated, 'router.append_to_lookup_table');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.stack) {
      cmdLogger.error(`Stack trace: ${error.stack}`);
    }

    // Provide helpful suggestions for common errors
    const suggestions: string[] = [];
    if (message.includes('not found')) {
      suggestions.push('Verify the lookup table address exists and is correct');
      suggestions.push("Ensure you're connected to the correct Solana network");
    }
    if (message.includes('Authority mismatch')) {
      suggestions.push('Verify the authority has permission to modify this ALT');
      suggestions.push('Check that the authority address is correct');
    }
    if (message.includes('exceed 256 addresses')) {
      suggestions.push('Reduce the number of addresses to append');
      suggestions.push('Consider creating a new ALT if you need more addresses');
    }

    TransactionDisplay.displayError(message, suggestions.length > 0 ? suggestions : undefined);
    process.exitCode = 1;
  }
}
