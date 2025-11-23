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
import {
  AddressLookupTableProgram,
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { getRpcUrl, type SolanaEnvironment } from '../src/utils/constants.js';
import { validateArgs } from '../src/utils/validation.js';
import { CreateAltArgsSchema } from '../src/types/index.js';
import { createChildLogger, logger } from '../src/utils/logger.js';
import { loadKeypair, executeTransaction } from '../src/utils/transaction-executor.js';
import { getAddressExplorerUrl, getTransactionExplorerUrl } from '../src/utils/explorer.js';
const program = new Command();

program
  .name('ccip-create-alt')
  .description('Create an empty Address Lookup Table with EOA payer and multisig authority')
  .version('1.0.0')
  .requiredOption('--keypair <path>', 'EOA keypair file path for paying and executing')
  .requiredOption('--authority <pubkey>', 'ALT authority (Squads vault address)')
  .requiredOption('--env <env>', 'Environment (mainnet, devnet, testnet, localhost)')
  .option('--json', 'Output as JSON for scripting')
  .action(async options => {
    const cmdLogger = createChildLogger(logger, { command: 'router.create-alt' });

    try {
      // Validate and transform arguments using existing validation
      const parsed = validateArgs(CreateAltArgsSchema, {
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
        console.log('🔄 Creating Address Lookup Table (no addresses appended)...');
        console.log(`   Payer:     ${payer.publicKey.toBase58()}`);
        console.log(`   Authority: ${args.authority.toBase58()}`);
      }

      cmdLogger.debug(
        {
          payer: payer.publicKey.toBase58(),
          authority: args.authority.toBase58(),
        },
        'Deriving ALT address'
      );

      const { instruction: createInstruction, lookupTableAddress } =
        buildUnsignedCreateLookupTableInstruction({
          authority: args.authority,
          payer: payer.publicKey,
          recentSlot: await connection.getSlot(),
        });

      const instructions = [createInstruction];

      if (!options.json) {
        console.log('   Instructions: 1 (create only)');
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

type BuildUnsignedCreateLookupTableInstructionParams = {
  authority: PublicKey;
  payer: PublicKey;
  recentSlot: number;
};

const CREATE_LOOKUP_TABLE_DISCRIMINATOR = 0;
const CREATE_LOOKUP_TABLE_DATA_LENGTH = 13;

type BuildUnsignedCreateLookupTableInstructionResult = {
  instruction: TransactionInstruction;
  lookupTableAddress: PublicKey;
};

function buildUnsignedCreateLookupTableInstruction({
  authority,
  payer,
  recentSlot,
}: BuildUnsignedCreateLookupTableInstructionParams): BuildUnsignedCreateLookupTableInstructionResult {
  const recentSlotBigInt = BigInt(recentSlot);
  const recentSlotBuffer = Buffer.alloc(8);
  recentSlotBuffer.writeBigUInt64LE(recentSlotBigInt);

  const [lookupTableAddress, bump] = PublicKey.findProgramAddressSync(
    [authority.toBuffer(), recentSlotBuffer],
    AddressLookupTableProgram.programId
  );

  const data = Buffer.alloc(CREATE_LOOKUP_TABLE_DATA_LENGTH);
  data.writeUInt32LE(CREATE_LOOKUP_TABLE_DISCRIMINATOR, 0);
  data.writeBigUInt64LE(recentSlotBigInt, 4);
  data.writeUInt8(bump, 12);

  const instruction = new TransactionInstruction({
    programId: AddressLookupTableProgram.programId,
    keys: [
      { pubkey: lookupTableAddress, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  return { instruction, lookupTableAddress };
}

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
  console.log('✅ Address Lookup Table Created (no addresses appended)');
  console.log('');
  console.log(`   ALT Address:     ${summary.altAddress}`);
  console.log(`   Authority:       ${summary.authority}`);
  console.log(`   Payer:           ${summary.payer}`);
  console.log(`   Transaction:     ${summary.signature}`);
  console.log(`   Instructions:    ${summary.instructionCount}`);
  console.log(`   Explorer (tx):   ${summary.explorer.transaction}`);
  console.log(`   Explorer (ALT):  ${summary.explorer.address}`);
  console.log('');
  console.log('ℹ️  Append addresses later via Squads or the append-to-lookup-table command.');
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

  return suggestions;
}
