import { Command } from 'commander';
import { registerCommands } from './commands/index.js';

import { logger } from './utils/logger.js';
import {
  CLI_CONFIG,
  DEFAULT_KEYPAIR_PATH,
  SOLANA_ENVIRONMENTS,
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
      'Sign and send the transaction with a local keypair instead of outputting Base58'
    )
    .option(
      '--keypair <path>',
      `Path to keypair file (default: ${DEFAULT_KEYPAIR_PATH} when --execute is set)`
    )
    .hook('preAction', thisCommand => {
      const opts = thisCommand.opts();

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
    console.log('🚀 Getting Started:');
    console.log('  1. View available commands:');
    console.log('     $ pnpm bs58 --help');
    console.log('');
    console.log('  2. Generate a transaction (Devnet example):');
    console.log('     $ pnpm bs58 --env devnet \\');
    console.log('       burnmint-token-pool --instruction accept-ownership \\');
    console.log('       --program-id "Your_Program_ID" \\');
    console.log('       --mint "Token_Mint_Address" \\');
    console.log('       --authority "New_Authority_PublicKey"');
    console.log('');
    console.log('  3. Execute directly with a local keypair (Devnet example):');
    console.log('     $ pnpm bs58 --env devnet --execute \\');
    console.log('       burnmint-token-pool --instruction accept-ownership \\');
    console.log('       --program-id "Your_Program_ID" \\');
    console.log('       --mint "Token_Mint_Address" \\');
    console.log('       --authority "Your_EOA_PublicKey"');
    console.log('');
    console.log('💡 Tips:');
    console.log('  • Use --verbose for detailed logging');
    console.log('  • Transaction data is Base58-encoded for Squads multisig');
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

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
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
