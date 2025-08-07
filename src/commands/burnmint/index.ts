import { Command } from 'commander';
import { acceptOwnershipCommand } from './accept-ownership.js';
import { setChainRateLimitCommand } from './set-chain-rate-limit.js';

/**
 * Burnmint Token Pool commands
 */
export function createBurnmintCommands(): Command {
  const burnmintTokenPool = new Command('burnmint-token-pool')
    .description('Burnmint Token Pool Program commands')
    .alias('bm')
    .requiredOption(
      '--instruction <instruction>',
      'Instruction to execute (accept-ownership, set-chain-rate-limit)'
    )
    .option(
      '--program-id <programId>',
      'Burnmint token pool program ID (required for all instructions)'
    )
    .option('--mint <mint>', 'Token mint address (required for all instructions)')
    .option('--authority <authority>', 'Authority public key (required for all instructions)')
    // setChainRateLimit specific options
    .option(
      '--remote-chain-selector <selector>',
      'Remote chain selector (required for set-chain-rate-limit)'
    )
    .option(
      '--inbound-enabled <enabled>',
      'Enable inbound rate limiting (true/false, required for set-chain-rate-limit)'
    )
    .option(
      '--inbound-capacity <capacity>',
      'Inbound rate limit capacity (required for set-chain-rate-limit)'
    )
    .option('--inbound-rate <rate>', 'Inbound rate limit rate (required for set-chain-rate-limit)')
    .option(
      '--outbound-enabled <enabled>',
      'Enable outbound rate limiting (true/false, required for set-chain-rate-limit)'
    )
    .option(
      '--outbound-capacity <capacity>',
      'Outbound rate limit capacity (required for set-chain-rate-limit)'
    )
    .option(
      '--outbound-rate <rate>',
      'Outbound rate limit rate (required for set-chain-rate-limit)'
    )
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

      // Common required options for all instructions
      if (!options.programId || !options.mint || !options.authority) {
        console.error('❌ All instructions require: --program-id, --mint, and --authority');
        process.exit(1);
      }

      if (options.instruction === 'accept-ownership') {
        // accept-ownership only needs the common options
      } else if (options.instruction === 'set-chain-rate-limit') {
        const requiredSetChainRateLimit = [
          'remoteChainSelector',
          'inboundEnabled',
          'inboundCapacity',
          'inboundRate',
          'outboundEnabled',
          'outboundCapacity',
          'outboundRate',
        ];

        const missing = requiredSetChainRateLimit.filter(opt => !options[opt]);
        if (missing.length > 0) {
          console.error(
            `❌ set-chain-rate-limit instruction requires: ${missing.map(opt => `--${opt.replace(/([A-Z])/g, '-$1').toLowerCase()}`).join(', ')}`
          );
          console.error('');
          console.error('Example:');
          console.error('  $ pnpm bs58 burnmint-token-pool --instruction set-chain-rate-limit \\');
          console.error('    --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \\');
          console.error('    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \\');
          console.error('    --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \\');
          console.error('    --remote-chain-selector "1234567890" \\');
          console.error('    --inbound-enabled "true" \\');
          console.error('    --inbound-capacity "1000000" \\');
          console.error('    --inbound-rate "1000" \\');
          console.error('    --outbound-enabled "false" \\');
          console.error('    --outbound-capacity "0" \\');
          console.error('    --outbound-rate "0"');
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

  # Set chain rate limit for remote chain
  $ pnpm bs58 --env devnet burnmint-token-pool \\
    --instruction set-chain-rate-limit \\
    --program-id "BurnMintProgramID123456789..." \\
    --mint "TokenMintAddress123456789..." \\
    --authority "AuthorityPublicKey123456789..." \\
    --remote-chain-selector "1234567890" \\
    --inbound-enabled "true" \\
    --inbound-capacity "1000000" \\
    --inbound-rate "1000" \\
    --outbound-enabled "false" \\
    --outbound-capacity "0" \\
    --outbound-rate "0"

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
  • accept-ownership      Accept ownership of a token pool
  • set-chain-rate-limit  Configure rate limiting for a remote chain

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
      } else if (options.instruction === 'set-chain-rate-limit') {
        setChainRateLimitCommand(options, command);
      } else {
        console.error(`❌ Unknown instruction: ${options.instruction}`);
        console.error('Available instructions: accept-ownership, set-chain-rate-limit');
        process.exit(1);
      }
    });

  return burnmintTokenPool;
}
