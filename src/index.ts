#!/usr/bin/env node
import { Command } from 'commander';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerCommands } from './commands/index.js';
import { installJsonExitHook, redirectChatterToStderr } from './utils/json-output.js';

import { logger } from './utils/logger.js';
import {
  CLI_CONFIG,
  DEFAULT_KEYPAIR_PATH,
  resolveTransactionOutputFormat,
  SOLANA_ENVIRONMENTS,
  TRANSACTION_OUTPUT_FORMATS,
  TX_OUTPUT_FORMAT_ENV_VAR,
  type SolanaEnvironment,
} from './utils/constants.js';

/**
 * Main CLI application entry point
 */
async function main(): Promise<void> {
  const program = new Command();

  // Configure main program
  program
    .name(CLI_CONFIG.NAME)
    .description(CLI_CONFIG.DESCRIPTION)
    .version(CLI_CONFIG.VERSION, '-v, --version', 'display version number');

  // Global options
  program
    .option('--verbose', 'enable verbose logging')
    .option(
      '--env, --environment <env>',
      `Solana environment (${Object.keys(SOLANA_ENVIRONMENTS).join('|')})`
    )
    .option('--rpc-url <url>', 'Custom Solana RPC URL (overrides --env if provided)')
    .option(
      '--execute',
      'Sign and send the transaction with a local keypair instead of outputting encoded transaction data'
    )
    .option(
      '--keypair <path>',
      `Path to keypair file (default: ${DEFAULT_KEYPAIR_PATH} when --execute is set)`
    )
    .option(
      '--format <format>',
      `Transaction output format (${TRANSACTION_OUTPUT_FORMATS.join('|')}; default: base58, or ${TX_OUTPUT_FORMAT_ENV_VAR} env var)`
    )
    .option(
      '--json',
      'Emit one machine-readable JSON object on stdout and send all other output to stderr'
    )
    .hook('preAction', thisCommand => {
      const opts = thisCommand.opts();

      // Do this before anything prints. From here on stdout belongs to emitJson alone.
      if (opts.json) {
        redirectChatterToStderr();
        installJsonExitHook();
      }

      // Configure logging level
      if (opts.verbose) {
        // Set logger to debug level for verbose output
        logger.level = 'debug';
        logger.info('Verbose logging enabled (debug level)');
      } else {
        // Ensure logger is at info level for normal operation
        logger.level = 'info';
      }

      // Global environment/RPC resolution (but validation is done by individual commands)
      const hasEnv = opts.environment;
      const hasRpcUrl = opts.rpcUrl;

      // Resolve environment to RPC URL if provided
      if (hasEnv && hasRpcUrl) {
        console.error('❌ Cannot use both --env and --rpc-url simultaneously');
        console.error('💡 Choose one:');
        console.error(
          '   • Use --env for predefined environments (devnet, mainnet, testnet, localhost)'
        );
        console.error('   • Use --rpc-url for custom endpoints');
        process.exit(1);
      }

      // Validate environment if provided
      if (hasEnv && !Object.keys(SOLANA_ENVIRONMENTS).includes(hasEnv)) {
        console.error(`❌ Invalid environment: ${hasEnv}`);
        console.error(`Available environments: ${Object.keys(SOLANA_ENVIRONMENTS).join(', ')}`);
        process.exit(1);
      }

      // Resolve transaction output format: --format > CCIP_TX_OUTPUT_FORMAT env > base58
      const formatResolution = resolveTransactionOutputFormat(opts.format);
      if (!formatResolution.ok) {
        if (formatResolution.source === 'cli') {
          console.error(`❌ Invalid format: ${formatResolution.value}`);
        } else {
          console.error(`❌ Invalid ${TX_OUTPUT_FORMAT_ENV_VAR}: ${formatResolution.value}`);
        }
        console.error(`Available formats: ${TRANSACTION_OUTPUT_FORMATS.join(', ')}`);
        process.exit(1);
      }
      opts.format = formatResolution.format;

      // Store resolved RPC URL for easy access by subcommands
      if (hasRpcUrl) {
        opts.resolvedRpcUrl = hasRpcUrl;
      } else if (hasEnv) {
        opts.resolvedRpcUrl = SOLANA_ENVIRONMENTS[hasEnv as SolanaEnvironment];
      }

      // Execution mode validation
      if (opts.keypair && !opts.execute) {
        console.error('❌ --keypair can only be used with --execute');
        process.exit(1);
      }

      if (opts.execute) {
        if (!opts.resolvedRpcUrl) {
          console.error('❌ --execute requires --env or --rpc-url');
          process.exit(1);
        }
        if (!opts.keypair) {
          opts.keypair = DEFAULT_KEYPAIR_PATH;
        }
      }
    });

  // Register all program-specific commands (for backwards compatibility)
  registerCommands(program);

  // Add help examples
  program.on('--help', () => {
    console.log('');
    console.log('⚠️  Chainlink example/template — unaudited. Test on devnet first.');
    console.log('');
    console.log('🚀 Getting Started:');
    console.log('  1. View available commands:');
    console.log(`     $ ${CLI_CONFIG.NAME} --help`);
    console.log('');
    console.log('  2. Read the docs that shipped with this build:');
    console.log(`     $ ${CLI_CONFIG.NAME} docs --path`);
    console.log('');
    console.log('  3. Generate a transaction (Devnet example):');
    console.log(`     $ ${CLI_CONFIG.NAME} --env devnet \\`);
    console.log('       burnmint-token-pool --instruction accept-ownership \\');
    console.log('       --program-id "Your_Program_ID" \\');
    console.log('       --mint "Token_Mint_Address" \\');
    console.log('       --authority "New_Authority_PublicKey"');
    console.log('');
    console.log('  4. Execute directly with a local keypair (Devnet example):');
    console.log(`     $ ${CLI_CONFIG.NAME} --env devnet --execute \\`);
    console.log('       burnmint-token-pool --instruction accept-ownership \\');
    console.log('       --program-id "Your_Program_ID" \\');
    console.log('       --mint "Token_Mint_Address" \\');
    console.log('       --authority "Your_EOA_PublicKey"');
    console.log('');
    console.log('💡 Tips:');
    console.log('  • Use --verbose for detailed logging');
    console.log(
      `  • Transaction data is Base58 by default (use --format or export ${TX_OUTPUT_FORMAT_ENV_VAR}=base64)`
    );
    console.log('  • Use --execute to sign and send with your local keypair');
    console.log('  • --keypair defaults to ~/.config/solana/id.json when --execute is set');
    console.log('  • Always test on Devnet first!');
    console.log('');
  });

  // Parse command line arguments
  await program.parseAsync(process.argv);
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error(
    {
      reason: reason instanceof Error ? reason.message : String(reason),
      promise: promise.toString(),
    },
    'Unhandled promise rejection'
  );
  process.exit(1);
});

process.on('uncaughtException', error => {
  logger.error(
    {
      error: error.message,
      stack: error.stack,
    },
    'Uncaught exception'
  );
  process.exit(1);
});

/**
 * True when this module is the process entry point.
 *
 * Compares real paths, not raw argv. A global install exposes the CLI as a symlink
 * (`<prefix>/bin/cct-solana-tx` -> `<prefix>/lib/node_modules/<pkg>/dist/index.js`), so comparing
 * `import.meta.url` to `process.argv[1]` never matches: the binary exits without running anything,
 * no output, no error, exit 0.
 */
function isEntryPoint(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(invoked);
  } catch {
    return false;
  }
}

// Run main function if this file is executed directly
if (isEntryPoint()) {
  main().catch(error => {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Main execution failed'
    );
    process.exit(1);
  });
}
