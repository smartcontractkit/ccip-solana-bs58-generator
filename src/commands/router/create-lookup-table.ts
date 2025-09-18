import { Command } from 'commander';
import { Connection } from '@solana/web3.js';
import { validateArgs } from '../../utils/validation.js';
import { RouterCreateLookupTableArgsSchema } from '../../types/index.js';
import { TransactionDisplay } from '../../utils/display.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { buildCreateAndExtendAlt } from '../../utils/alt.js';
import { logger } from '../../utils/logger.js';

export async function createLookupTableCommand(options: Record<string, string>, command: Command) {
  try {
    const parent = command.parent!;
    const globalOptions = parent.opts();

    const parsed = validateArgs(RouterCreateLookupTableArgsSchema, {
      programId: options.programId,
      feeQuoterProgramId: options.feeQuoterProgramId,
      poolProgramId: options.poolProgramId,
      mint: options.mint,
      authority: options.authority,
      additionalAddresses: options.additionalAddresses,
      rpcUrl: globalOptions.resolvedRpcUrl,
    });

    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      process.exit(1);
    }
    const rpcUrl = parsed.data.rpcUrl ?? globalOptions.resolvedRpcUrl!;

    console.log('🔄 Generating create_lookup_table transaction...');

    const connection = new Connection(rpcUrl);
    const { instructions, lookupTableAddress } = await buildCreateAndExtendAlt({
      connection,
      authority: parsed.data.authority,
      routerProgramId: parsed.data.programId,
      feeQuoterProgramId: parsed.data.feeQuoterProgramId,
      poolProgramId: parsed.data.poolProgramId,
      tokenMint: parsed.data.mint,
      additionalAddresses: parsed.data.additionalAddresses,
    });

    const txBuilder = new TransactionBuilder({ rpcUrl });
    console.log('🔄 Building and simulating transaction...');
    const generated = await txBuilder.buildTransaction(
      instructions,
      parsed.data.authority,
      'router.create_lookup_table'
    );

    console.log(`📮 Derived Lookup Table Address: ${lookupTableAddress.toBase58()}`);
    console.log('   ✅ Transaction simulation completed');
    TransactionDisplay.displayResults(generated, 'router.create_lookup_table');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    TransactionDisplay.displayError(message);
    process.exitCode = 1;
  }
}
