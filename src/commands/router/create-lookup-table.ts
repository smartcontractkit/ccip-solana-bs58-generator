import { Command } from 'commander';
import { Connection } from '@solana/web3.js';
import { validateArgs } from '../../utils/validation.js';
import { RouterCreateLookupTableArgsSchema } from '../../types/index.js';
import { finalizeTransaction } from '../../utils/finalize-transaction.js';
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
    await finalizeTransaction({
      txBuilder,
      instructions,
      payer: parsed.data.authority,
      instructionName: 'router.create_lookup_table',
      command,
    });

    console.log(`📮 Derived Lookup Table Address: ${lookupTableAddress.toBase58()}`);
    console.log('   ✅ Transaction simulation completed');
    console.log('');
    console.log('⚠️  ALT CREATION TIMING CONSTRAINT');
    console.log('   This transaction must be imported AND executed within 60-90 seconds');
    console.log('   due to slot-dependent address derivation.');
    console.log('');
    console.log('💡 RECOMMENDED: Use the companion tool for immediate execution:');
    console.log(
      `   pnpm create-alt --keypair <EOA_KEYPAIR> --authority ${parsed.data.authority.toBase58()} \\`
    );
    console.log(`     --program-id ${parsed.data.programId.toBase58()} \\`);
    console.log(`     --fee-quoter-program-id ${parsed.data.feeQuoterProgramId.toBase58()} \\`);
    console.log(`     --pool-program-id ${parsed.data.poolProgramId.toBase58()} \\`);
    console.log(`     --mint ${parsed.data.mint.toBase58()} \\`);
    console.log(`     --env ${globalOptions.environment || 'mainnet'}`);
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    TransactionDisplay.displayError(message);
    process.exitCode = 1;
  }
}
