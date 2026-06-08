import { Command } from 'commander';
import { Connection } from '@solana/web3.js';
import { validateArgs } from '../../utils/validation.js';
import { RouterAppendToLookupTableArgsSchema } from '../../types/index.js';
import { finalizeTransaction } from '../../utils/finalize-transaction.js';
import { TransactionDisplay } from '../../utils/display.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { buildAppendToAlt, deriveCcipBaseAddresses } from '../../utils/alt.js';
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
      programId: options.programId,
      feeQuoterProgramId: options.feeQuoterProgramId,
      poolProgramId: options.poolProgramId,
      mint: options.mint,
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

    // Determine if we're using CCIP auto-derivation or manual addresses
    const hasCcipParams =
      parsed.data.programId &&
      parsed.data.feeQuoterProgramId &&
      parsed.data.poolProgramId &&
      parsed.data.mint;

    let addressesToAppend = [...parsed.data.additionalAddresses];
    let ccipAddressCount = 0;

    if (hasCcipParams) {
      cmdLogger.debug('Deriving CCIP base addresses');

      const { addresses: ccipAddresses, addressLabels } = await deriveCcipBaseAddresses({
        connection,
        routerProgramId: parsed.data.programId!,
        feeQuoterProgramId: parsed.data.feeQuoterProgramId!,
        poolProgramId: parsed.data.poolProgramId!,
        tokenMint: parsed.data.mint!,
        lookupTableAddress: parsed.data.lookupTableAddress,
      });

      ccipAddressCount = ccipAddresses.length;

      cmdLogger.debug(
        {
          ccipAddressCount,
          ccipAddresses: ccipAddresses.map((a, i) => ({
            label: addressLabels[i],
            address: a.toBase58(),
          })),
        },
        'CCIP addresses derived'
      );

      // Merge CCIP addresses with manual addresses (CCIP first)
      addressesToAppend = [...ccipAddresses, ...parsed.data.additionalAddresses];

      // Log address breakdown for transparency
      if (parsed.data.additionalAddresses.length > 0) {
        cmdLogger.info(
          `📦 Appending ${ccipAddressCount} CCIP addresses + ${parsed.data.additionalAddresses.length} manual addresses`
        );
      } else {
        cmdLogger.info(`📦 Appending ${ccipAddressCount} CCIP addresses`);
      }
    } else {
      cmdLogger.debug(
        {
          manualAddressCount: parsed.data.additionalAddresses.length,
        },
        'Using manual addresses only'
      );
    }

    // Log current state for transparency
    cmdLogger.debug(
      {
        lookupTableAddress: parsed.data.lookupTableAddress.toBase58(),
        authority: parsed.data.authority.toBase58(),
        totalAddressesToAdd: addressesToAppend.length,
      },
      'Appending addresses to existing ALT'
    );

    const { instructions, totalAddressesAfterAppend } = await buildAppendToAlt({
      connection,
      authority: parsed.data.authority,
      lookupTableAddress: parsed.data.lookupTableAddress,
      additionalAddresses: addressesToAppend,
    });

    const txBuilder = new TransactionBuilder({ rpcUrl });
    cmdLogger.info('🔄 Building and simulating transaction...');

    // Display success info before transaction details
    console.log(`📮 Lookup Table Address: ${parsed.data.lookupTableAddress.toBase58()}`);
    if (hasCcipParams) {
      console.log(`📦 CCIP addresses added: ${ccipAddressCount}`);
      if (parsed.data.additionalAddresses.length > 0) {
        console.log(`➕ Manual addresses added: ${parsed.data.additionalAddresses.length}`);
      }
    } else {
      console.log(`📊 Addresses added: ${parsed.data.additionalAddresses.length}`);
    }
    console.log(`📈 Total addresses after append: ${totalAddressesAfterAppend}`);

    await finalizeTransaction({
      txBuilder,
      instructions,
      payer: parsed.data.authority,
      instructionName: 'router.append_to_lookup_table',
      command,
    });
    console.log('   ✅ Transaction simulation completed');
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
    if (message.includes('CCIP program parameters')) {
      suggestions.push(
        'Either provide all four CCIP parameters (program-id, fee-quoter-program-id, pool-program-id, mint)'
      );
      suggestions.push('Or use --additional-addresses for manual address specification');
      suggestions.push('You can also combine both CCIP auto-derivation and manual addresses');
    }

    TransactionDisplay.displayError(message, suggestions.length > 0 ? suggestions : undefined);
    process.exitCode = 1;
  }
}
