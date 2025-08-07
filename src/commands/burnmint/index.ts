import { Command } from 'commander';
import { acceptOwnershipCommand } from './accept-ownership.js';

/**
 * Burnmint Token Pool commands
 */
export function createBurnmintCommands(): Command {
  const burnmintTokenPool = new Command('burnmint-token-pool')
    .description('Burnmint Token Pool Program commands')
    .alias('bm');

  // Accept ownership command
  burnmintTokenPool
    .command('accept-ownership')
    .description('Accept ownership of a burnmint token pool')
    .option('--program <name>', 'Program name (defaults to "burnmint-token-pool")')
    .requiredOption('--program-id <programId>', 'Burnmint token pool program ID')
    .requiredOption('--mint <mint>', 'Token mint address')
    .requiredOption('--authority <authority>', 'New authority public key')
    .hook('preAction', thisCommand => {
      // Environment/RPC validation is handled by the global preAction hook
      const globalOpts = thisCommand.parent?.parent?.opts() || {};
      if (!globalOpts.resolvedRpcUrl) {
        console.error('❌ Either --env or --rpc-url is required for transaction commands');
        console.error('💡 Use --env devnet or --rpc-url "https://custom-endpoint.com"');
        process.exit(1);
      }
    })
    .addHelpText(
      'after',
      `
Examples:
  # Accept ownership using environment (recommended)
  $ ccip-gen --env devnet burnmint-token-pool accept-ownership \\
    --program-id "BurnMintProgramID123456789..." \\
    --mint "TokenMintAddress123456789..." \\
    --authority "NewAuthorityPublicKey123456789..."

  # Using custom RPC URL (advanced)
  $ ccip-gen --rpc-url "https://custom-rpc.com" \\
    burnmint-token-pool accept-ownership \\
    --program-id "Your_Program_ID" \\
    --mint "Your_Token_Mint" \\
    --authority "Your_Authority"

  # With verbose logging for debugging
  $ ccip-gen --verbose --env testnet \\
    burnmint-token-pool accept-ownership \\
    --program-id "..." --mint "..." --authority "..."

💡 Tips:
  • Use --env devnet for testing (cleaner than full URLs)
  • Use --env mainnet for production (be careful!)
  • Arguments can be in any order for better UX
  • Copy the generated Base58 transaction into Squads multisig
  • All public keys must be valid Base58 format (44 characters)
`
    )
    .action(acceptOwnershipCommand);

  return burnmintTokenPool;
}
