import { Command } from 'commander';
import { TransactionInstruction, PublicKey } from '@solana/web3.js';
import { validateArgs, validateRpcConnectivity } from '../../utils/validation.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { TransactionDisplay } from '../../utils/display.js';
import { MetaplexUpdateAuthorityArgsSchema } from '../../types/index.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { InstructionBuilder as MplInstructionBuilder } from '../../programs/metaplex/instructions.js';
import { logger } from '../../utils/logger.js';

export async function updateMetadataAuthorityCommand(
  options: Record<string, string>,
  command: Command
) {
  const global = command.parent?.opts() || {};
  const parsed = validateArgs(MetaplexUpdateAuthorityArgsSchema, {
    authority: options.authority,
    mint: options.mint,
    newAuthority: options.newAuthority,
    rpcUrl: global.resolvedRpcUrl,
  });
  if (!parsed.success) {
    console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
    process.exit(1);
  }
  const rpcUrl = parsed.data.rpcUrl ?? (global.resolvedRpcUrl as string);
  if (!(await validateRpcConnectivity(rpcUrl))) {
    console.error(`❌ Cannot connect to RPC endpoint: ${rpcUrl}`);
    process.exit(1);
  }

  const umi = createUmi(rpcUrl);
  const mpl = new MplInstructionBuilder(umi);
  const ix = mpl.updateAuthority(parsed.data.mint.toBase58(), parsed.data.newAuthority.toBase58());

  const ixs: TransactionInstruction[] = [ix];
  const tb = new TransactionBuilder({ rpcUrl });
  logger.info('🔄 Building and simulating transaction...');
  const tx = await tb.buildTransaction(
    ixs,
    parsed.data.authority as PublicKey,
    'metaplex.update_authority'
  );
  logger.info('✅ Transaction simulation completed');
  TransactionDisplay.displayResults(tx, 'metaplex.update_authority');
}
