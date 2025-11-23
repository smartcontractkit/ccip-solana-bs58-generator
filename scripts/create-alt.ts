#!/usr/bin/env node
/**
 * CCIP ALT Creator - Companion tool for ccip-bs58 CLI
 *
 * Purpose: Create and populate Address Lookup Tables with multisig authority.
 * Use Case: Atomic ALT creation for Squads multisigs using EOA payer.
 *
 * Why separate?: ALT creation requires immediate execution (slot-dependent).
 * Main CLI generates transactions for Squads; this tool executes directly.
 */

import { Command } from 'commander';
import { Connection } from '@solana/web3.js';
import { buildCreateAndExtendAlt } from '../src/utils/alt.js';
import { getRpcUrl, type SolanaEnvironment } from '../src/utils/constants.js';
import { validateArgs } from '../src/utils/validation.js';
import { RouterCreateAltExecutorArgsSchema } from '../src/types/index.js';
import { createChildLogger, logger } from '../src/utils/logger.js';
import { loadKeypair, executeTransaction } from '../src/utils/transaction-executor.js';
import { getAddressExplorerUrl, getTransactionExplorerUrl } from '../src/utils/explorer.js';
const program = new Command();

program
  .name('ccip-create-alt')
  .description('Execute ALT creation with EOA payer and multisig authority')
  .version('1.0.0')
  .requiredOption('--keypair <path>', 'EOA keypair file path for paying and executing')
  .requiredOption('--authority <pubkey>', 'ALT authority (Squads vault address)')
  .requiredOption('--program-id <pubkey>', 'CCIP Router program ID')
  .requiredOption('--fee-quoter-program-id <pubkey>', 'Fee Quoter program ID')
  .requiredOption('--pool-program-id <pubkey>', 'Pool program ID')
  .requiredOption('--mint <pubkey>', 'Token mint address')
  .requiredOption('--env <env>', 'Environment (mainnet, devnet, testnet, localhost)')
  .option('--additional-addresses <json>', 'Additional addresses as JSON array', '[]')
  .option('--json', 'Output as JSON for scripting')
  .action(async options => {
    const cmdLogger = createChildLogger(logger, { command: 'router.create-alt' });

    try {
      // Validate and transform arguments using existing validation
      const parsed = validateArgs(RouterCreateAltExecutorArgsSchema, {
        ...options,
        rpcUrl: getRpcUrl(options.env),
      });

      if (!parsed.success) {
        if (options.json) {
          console.error(JSON.stringify({ error: parsed.errors.join(', ') }));
        } else {
          console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
        }
        process.exit(1);
      }

      const { keypair: keypairPath, ...args } = parsed.data;

      // Load keypair using utility
      cmdLogger.debug({ keypairPath }, 'Loading keypair');
      const payer = loadKeypair(keypairPath);

      // Create connection
      const connection = new Connection(args.rpcUrl);

      if (!options.json) {
        console.log('🔄 Creating and populating Address Lookup Table...');
        console.log(`   Payer:     ${payer.publicKey.toBase58()}`);
        console.log(`   Authority: ${args.authority.toBase58()}`);
        console.log(`   Mint:      ${args.mint.toBase58()}`);
      }

      cmdLogger.debug(
        {
          payer: payer.publicKey.toBase58(),
          authority: args.authority.toBase58(),
          mint: args.mint.toBase58(),
          additionalAddressCount: args.additionalAddresses.length,
        },
        'Building ALT creation instructions'
      );

      // Build instructions using existing logic
      const { instructions, lookupTableAddress } = await buildCreateAndExtendAlt({
        connection,
        authority: args.authority,
        payer: payer.publicKey,
        routerProgramId: args.programId,
        feeQuoterProgramId: args.feeQuoterProgramId,
        poolProgramId: args.poolProgramId,
        tokenMint: args.mint,
        additionalAddresses: args.additionalAddresses,
      });

      if (!options.json) {
        console.log(`   Instructions: ${instructions.length} (create + extend)`);
        console.log(`   Derived ALT:  ${lookupTableAddress.toBase58()}`);
        console.log('');
        console.log('📤 Sending transaction...');
      }

      cmdLogger.info(
        {
          lookupTableAddress: lookupTableAddress.toBase58(),
          instructionCount: instructions.length,
        },
        'Executing ALT creation transaction'
      );

      // Execute using utility (static method)
      const signature = await executeTransaction(connection, instructions, [payer]);
      const env = args.env as SolanaEnvironment;
      const txExplorerUrl = getTransactionExplorerUrl(signature, env);
      const altExplorerUrl = getAddressExplorerUrl(lookupTableAddress.toBase58(), env);

      cmdLogger.info({ signature }, 'ALT creation successful');

      // Output results
      const summary: ExecutionSummary = {
        env,
        altAddress: lookupTableAddress.toBase58(),
        authority: args.authority.toBase58(),
        payer: payer.publicKey.toBase58(),
        signature,
        instructionCount: instructions.length,
        explorer: {
          transaction: txExplorerUrl,
          address: altExplorerUrl,
        },
      };

      if (options.json) {
        outputJson(summary);
      } else {
        outputHumanReadable(summary);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (error instanceof Error && error.stack) {
        cmdLogger.error(`Stack trace: ${error.stack}`);
      }

      const suggestions = buildSuggestions(message);
      if (options.json) {
        console.error(JSON.stringify({ error: message, success: false, suggestions }));
      } else {
        outputError(message, suggestions);
      }
      process.exit(1);
    }
  });

program.parse();

type ExecutionSummary = {
  env: SolanaEnvironment;
  altAddress: string;
  authority: string;
  payer: string;
  signature: string;
  instructionCount: number;
  explorer: {
    transaction: string;
    address: string;
  };
};

function outputJson(summary: ExecutionSummary): void {
  console.log(
    JSON.stringify({
      instruction: 'router.create_alt',
      success: true,
      ...summary,
    })
  );
}

function outputHumanReadable(summary: ExecutionSummary): void {
  console.log('');
  console.log('✅ Address Lookup Table Created and Populated!');
  console.log('');
  console.log(`   ALT Address:     ${summary.altAddress}`);
  console.log(`   Authority:       ${summary.authority}`);
  console.log(`   Payer:           ${summary.payer}`);
  console.log(`   Transaction:     ${summary.signature}`);
  console.log(`   Instructions:    ${summary.instructionCount}`);
  console.log(`   Explorer (tx):   ${summary.explorer.transaction}`);
  console.log(`   Explorer (ALT):  ${summary.explorer.address}`);
  console.log('');
  console.log('🎉 ALT is ready to use with CCIP Router!');
  console.log('');
  console.log('📋 To manage this ALT via Squads later, use:');
  console.log('');
  console.log(`   pnpm bs58 router --env ${summary.env} \\`);
  console.log('     --instruction append-to-lookup-table \\');
  console.log(`     --lookup-table-address ${summary.altAddress} \\`);
  console.log(`     --authority ${summary.authority} \\`);
  console.log("     --additional-addresses '[...]'");
  console.log('');
}

function outputError(message: string, suggestions: string[]): void {
  console.error('');
  console.error(`❌ Error: ${message}`);
  if (suggestions.length > 0) {
    console.error('');
    console.error('💡 Suggestions:');
    suggestions.forEach(s => console.error(`   • ${s}`));
  }
  console.error('');
}

function buildSuggestions(message: string): string[] {
  const suggestions: string[] = [];

  if (message.includes('Failed to load keypair')) {
    suggestions.push('Verify the keypair file path is correct');
    suggestions.push('Ensure the keypair file contains a valid JSON array');
  }

  if (message.includes('Invalid environment')) {
    suggestions.push('Use one of: mainnet, devnet, testnet, localhost');
  }

  if (message.includes('ALT cannot exceed 256 addresses')) {
    suggestions.push('Reduce the number of additional addresses');
    suggestions.push('Base addresses (10) + additional must not exceed 256');
  }

  return suggestions;
}
