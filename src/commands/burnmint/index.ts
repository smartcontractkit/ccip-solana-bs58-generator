import { Command } from 'commander';
import { acceptOwnershipCommand } from './accept-ownership.js';

/**
 * Burnmint Token Pool commands
 */
export function createBurnmintCommands(): Command {
  const burnmintTokenPool = new Command('burnmint-token-pool')
    .description('Burnmint Token Pool Program commands')
    .alias('bm')
    .requiredOption('--instruction <instruction>', 'Instruction to execute (accept-ownership)')
    .option(
      '--program-id <programId>',
      'Burnmint token pool program ID (required for accept-ownership)'
    )
    .option('--mint <mint>', 'Token mint address (required for accept-ownership)')
    .option('--authority <authority>', 'New authority public key (required for accept-ownership)')
    .hook('preAction', thisCommand => {
      // Environment/RPC validation is handled by the global preAction hook
      const globalOpts = thisCommand.parent?.opts() || {};
      if (!globalOpts.resolvedRpcUrl) {
        console.error('❌ Either --env or --rpc-url is required for transaction commands');
        console.error('💡 Use --env devnet or --rpc-url "https://custom-endpoint.com"');
        process.exit(1);
      }

      // Validate instruction-specific requirements
      const options = thisCommand.opts();
      if (options.instruction === 'accept-ownership') {
        if (!options.programId || !options.mint || !options.authority) {
          console.error(
            '❌ accept-ownership instruction requires: --program-id, --mint, and --authority'
          );
          console.error('');
          console.error('Example:');
          console.error('  $ pnpm bs58 burnmint-token-pool --instruction accept-ownership \\');
          console.error('    --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \\');
          console.error('    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \\');
          console.error('    --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY"');
          process.exit(1);
        }
      }
    })
    .addHelpText(
      'after',
      `
Examples:
  # Accept ownership using environment (recommended)
  $ pnpm bs58 --env devnet burnmint-token-pool \\
    --instruction accept-ownership \\
    --program-id "BurnMintProgramID123456789..." \\
    --mint "TokenMintAddress123456789..." \\
    --authority "NewAuthorityPublicKey123456789..."

  # Using custom RPC URL (advanced)
  $ pnpm bs58 --rpc-url "https://custom-rpc.com" \\
    burnmint-token-pool --instruction accept-ownership \\
    --program-id "Your_Program_ID" \\
    --mint "Your_Token_Mint" \\
    --authority "Your_Authority"

  # With verbose logging for debugging
  $ pnpm bs58 --verbose --env testnet \\
    burnmint-token-pool --instruction accept-ownership \\
    --program-id "..." --mint "..." --authority "..."

Available Instructions:
  • accept-ownership    Accept ownership of a token pool

💡 Tips:
  • Use --env devnet for testing (cleaner than full URLs)
  • Use --env mainnet for production (be careful!)
  • Arguments can be in any order for better UX
  • Copy the generated Base58 transaction into Squads multisig
  • All public keys must be valid Base58 format (44 characters)
`
    )
    .action((options, command) => {
      // Route to the appropriate instruction handler
      if (options.instruction === 'accept-ownership') {
        acceptOwnershipCommand(options, command);
      } else {
        console.error(`❌ Unknown instruction: ${options.instruction}`);
        console.error('Available instructions: accept-ownership');
        process.exit(1);
      }
    });

  return burnmintTokenPool;
}
