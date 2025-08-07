#!/usr/bin/env node

import { Command } from 'commander';
import { registerCommands } from './commands/index.js';

import { logger } from './utils/logger.js';
import { CLI_CONFIG, SOLANA_ENVIRONMENTS, type SolanaEnvironment } from './utils/constants.js';
import { PROGRAM_REGISTRY, getProgramConfig } from './types/program-registry.js';

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

      // Validate environment/RPC options for transaction commands
      const isTransactionCommand = ['accept-ownership'].includes(thisCommand.name());
      if (isTransactionCommand) {
        const hasEnv = opts.environment; // Commander.js uses 'environment' as property name
        const hasRpcUrl = opts.rpcUrl;

        // Must have either --env or --rpc-url, but not both
        if (!hasEnv && !hasRpcUrl) {
          console.error('❌ Either --env or --rpc-url is required for transaction commands');
          console.error('💡 Environment options:');
          console.error(
            `   ${Object.keys(SOLANA_ENVIRONMENTS)
              .map(env => `• ${env}: ${SOLANA_ENVIRONMENTS[env as SolanaEnvironment]}`)
              .join('\n   ')}`
          );
          console.error('');
          console.error('Usage examples:');
          console.error('   $ ccip-gen accept-ownership --env devnet ...');
          console.error('   $ ccip-gen accept-ownership --rpc-url "https://custom-rpc.com" ...');
          process.exit(1);
        }

        // Ensure mutual exclusivity
        if (hasEnv && hasRpcUrl) {
          console.error('❌ Cannot use both --env and --rpc-url simultaneously');
          console.error('💡 Choose one:');
          console.error(
            '   • Use --env for predefined environments (devnet, mainnet, testnet, localhost)'
          );
          console.error('   • Use --rpc-url for custom endpoints');
          console.error('');
          console.error('Examples:');
          console.error('   $ ccip-gen accept-ownership --env devnet ...');
          console.error('   $ ccip-gen accept-ownership --rpc-url "https://custom-rpc.com" ...');
          process.exit(1);
        }

        // Validate environment if provided
        if (hasEnv && !Object.keys(SOLANA_ENVIRONMENTS).includes(hasEnv)) {
          console.error(`❌ Invalid environment: ${hasEnv}`);
          console.error(`Available environments: ${Object.keys(SOLANA_ENVIRONMENTS).join(', ')}`);
          process.exit(1);
        }

        // Store resolved RPC URL for easy access
        if (hasRpcUrl) {
          opts.resolvedRpcUrl = hasRpcUrl;
        } else {
          opts.resolvedRpcUrl = SOLANA_ENVIRONMENTS[hasEnv as SolanaEnvironment];
        }
      }
    });

  // Add list-instructions command that works across all programs
  program
    .command('list-instructions')
    .description('List all available instructions across all programs')
    .option('--program <name>', 'Filter by specific program')
    .action(async options => {
      try {
        if (options.program) {
          // Show instructions for specific program
          const config = getProgramConfig(options.program);
          if (!config) {
            console.error(`❌ Unknown program: ${options.program}`);
            console.log('Available programs:', Object.keys(PROGRAM_REGISTRY).join(', '));
            process.exit(1);
          }

          // Show basic IDL information (all programs now have IDL)
          console.log(`📋 ${config.displayName}`);
          console.log(`   Instructions: ${config.idl!.instructions.length}`);
          console.log();

          console.log('📚 Available Instructions:');
          for (const instruction of config.idl!.instructions) {
            console.log(`    • ${instruction.name}`);
          }
        } else {
          // Show all programs
          console.log('🚀 Available Programs and Instructions:\\n');

          for (const [programName, config] of Object.entries(PROGRAM_REGISTRY)) {
            console.log(`📦 ${config.displayName} (${programName})`);
            console.log(`   ${config.description}`);

            // All programs now have IDL
            console.log(`   Instructions: ${config.idl!.instructions.length}`);

            console.log('   Instructions:');
            for (const instruction of config.idl!.instructions) {
              console.log(`     • ${instruction.name}`);
            }
            console.log();
          }

          console.log('💡 Usage Examples:');
          console.log(
            '    ccip-gen --rpc-url "https://api.devnet.solana.com" burnmint accept-ownership --help'
          );
          console.log('    ccip-gen list-instructions --program burnmint-token-pool');
        }
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to list instructions'
        );
        console.error('❌ Failed to list instructions');
        process.exit(1);
      }
    });

  // Add top-level commands that work with --program parameter
  program
    .command('accept-ownership')
    .description('Accept ownership of a token pool')
    .option('--program <name>', 'Program name (required)', 'burnmint-token-pool')
    .requiredOption('--program-id <programId>', 'Token pool program ID')
    .requiredOption('--mint <mint>', 'Token mint address')
    .requiredOption('--authority <authority>', 'New authority public key')
    .hook('preAction', thisCommand => {
      const commandOpts = thisCommand.opts();
      const globalOpts = thisCommand.parent?.opts() || {};

      // Validate program parameter
      if (!commandOpts.program) {
        console.error('❌ --program is required');
        console.error('Available programs: burnmint-token-pool, lockrelease-token-pool, router');
        process.exit(1);
      }

      // Handle environment/RPC validation for top-level commands
      const hasEnv = globalOpts.environment;
      const hasRpcUrl = globalOpts.rpcUrl;

      // Must have either --env or --rpc-url, but not both
      if (!hasEnv && !hasRpcUrl) {
        console.error('❌ Either --env or --rpc-url is required for transaction commands');
        console.error('💡 Environment options:');
        console.error(
          `   ${Object.keys(SOLANA_ENVIRONMENTS)
            .map(env => `• ${env}: ${SOLANA_ENVIRONMENTS[env as SolanaEnvironment]}`)
            .join('\n   ')}`
        );
        console.error('');
        console.error('Usage examples:');
        console.error('   $ ccip-gen accept-ownership --env devnet ...');
        console.error('   $ ccip-gen accept-ownership --rpc-url "https://custom-rpc.com" ...');
        process.exit(1);
      }

      // Ensure mutual exclusivity
      if (hasEnv && hasRpcUrl) {
        console.error('❌ Cannot use both --env and --rpc-url simultaneously');
        console.error('💡 Choose one:');
        console.error(
          '   • Use --env for predefined environments (devnet, mainnet, testnet, localhost)'
        );
        console.error('   • Use --rpc-url for custom endpoints');
        console.error('');
        console.error('Examples:');
        console.error('   $ ccip-gen accept-ownership --env devnet ...');
        console.error('   $ ccip-gen accept-ownership --rpc-url "https://custom-rpc.com" ...');
        process.exit(1);
      }

      // Validate environment if provided
      if (hasEnv && !Object.keys(SOLANA_ENVIRONMENTS).includes(hasEnv)) {
        console.error(`❌ Invalid environment: ${hasEnv}`);
        console.error(`Available environments: ${Object.keys(SOLANA_ENVIRONMENTS).join(', ')}`);
        process.exit(1);
      }

      // Store resolved RPC URL for easy access
      if (hasRpcUrl) {
        globalOpts.resolvedRpcUrl = hasRpcUrl;
      } else {
        globalOpts.resolvedRpcUrl = SOLANA_ENVIRONMENTS[hasEnv as SolanaEnvironment];
      }
    })
    .addHelpText(
      'after',
      `
Examples:
  # Accept ownership using environment (recommended)
  $ ccip-gen accept-ownership \\
    --program burnmint-token-pool \\
    --env devnet \\
    --program-id "BurnMintProgramID123456789..." \\
    --mint "TokenMintAddress123456789..." \\
    --authority "NewAuthorityPublicKey123456789..."

  # Using custom RPC URL (advanced)
  $ ccip-gen accept-ownership \\
    --program burnmint-token-pool \\
    --rpc-url "https://custom-rpc-endpoint.com" \\
    --program-id "Your_Program_ID" \\
    --mint "Your_Token_Mint" \\
    --authority "Your_Authority"

  # Alternative order (same result)
  $ ccip-gen --env mainnet accept-ownership \\
    --program burnmint-token-pool \\
    --program-id "Production_Program_ID" \\
    --mint "Production_Token_Mint" \\
    --authority "Production_Authority"

💡 Tips:
  • Arguments can be in any order for better UX
  • Use --env for common environments (devnet, mainnet, testnet, localhost)
  • Use --rpc-url for custom endpoints
  • Use --verbose for detailed logging
`
    )
    .action(async (options, command) => {
      // Import the command dynamically based on program
      if (options.program === 'burnmint-token-pool') {
        const { acceptOwnershipCommand } = await import('./commands/burnmint/accept-ownership.js');
        return acceptOwnershipCommand(options, command);
      } else {
        console.error(`❌ Program "${options.program}" not yet supported for accept-ownership`);
        console.error('Available programs: burnmint-token-pool');
        process.exit(1);
      }
    });

  // Register all program-specific commands (for backwards compatibility)
  registerCommands(program);

  // Add help examples
  program.on('--help', () => {
    console.log('');
    console.log('🚀 Getting Started:');
    console.log('  1. List available commands:');
    console.log('     $ ccip-gen list-instructions');
    console.log('');
    console.log('  2. Generate a transaction (Devnet example):');
    console.log('     $ ccip-gen --rpc-url "https://api.devnet.solana.com" \\');
    console.log('       burnmint accept-ownership \\');
    console.log('       --program-id "Your_Program_ID" \\');
    console.log('       --mint "Token_Mint_Address" \\');
    console.log('       --authority "New_Authority_PublicKey"');
    console.log('');
    console.log('💡 Tips:');
    console.log('  • Use --verbose for detailed logging');
    console.log('  • Transaction data is Base58-encoded for Squads multisig');
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
