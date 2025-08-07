import { Command } from 'commander';
import { Connection, TransactionInstruction } from '@solana/web3.js';
import { validateArgs, validateRpcConnectivity } from '../../utils/validation.js';
import { TransactionBuilder } from '../../core/transaction-builder.js';
import { TransactionDisplay } from '../../utils/display.js';
import { detectTokenProgramId } from '../../utils/token.js';
import { InstructionBuilder as SplInstructionBuilder } from '../../programs/spl-token/instructions.js';
import { SplTransferMintAuthorityArgsSchema } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export async function transferMintAuthorityCommand(
  options: Record<string, string>,
  command: Command
) {
  try {
    const global = command.parent?.opts() || {};
    const parsed = validateArgs(SplTransferMintAuthorityArgsSchema, {
      authority: options.authority,
      mint: options.mint,
      newMintAuthority: options.newMintAuthority,
      multisig: options.multisig,
      multisigSigners: options.multisigSigners,
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

    const connection = new Connection(rpcUrl);
    const authority = parsed.data.authority;
    const mint = parsed.data.mint;
    const newMintAuthority = parsed.data.newMintAuthority;

    const tokenProgramId = await detectTokenProgramId(connection, mint);

    const builder = new SplInstructionBuilder(tokenProgramId);
    const ixs: TransactionInstruction[] = [
      builder.transferMintAuthority(
        mint,
        parsed.data.multisig ?? authority,
        newMintAuthority,
        parsed.data.multisigSigners ?? []
      ),
    ];

    const tb = new TransactionBuilder({ rpcUrl });
    logger.info('🔄 Building and simulating transaction...');
    const tx = await tb.buildTransaction(ixs, authority, 'spl.transfer_mint_authority');
    logger.info('✅ Transaction simulation completed');
    TransactionDisplay.displayResults(tx, 'spl.transfer_mint_authority');
  } catch (error) {
    logger.error('❌ Failed to transfer mint authority');
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    console.error('❌ Failed to transfer mint authority.');
    console.error('💡 Check your parameters, mint address, and RPC connection.');
    process.exit(1);
  }
}
