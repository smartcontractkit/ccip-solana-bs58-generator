import { Command } from 'commander';
import { acceptOwnershipCommand } from './accept-ownership.js';
import { initializePoolCommand } from './initialize-pool.js';
import { setChainRateLimitCommand } from './set-chain-rate-limit.js';
import { transferOwnershipCommand } from './transfer-ownership.js';
import { initChainRemoteConfigCommand } from './init-chain-remote-config.js';
import { editChainRemoteConfigCommand } from './edit-chain-remote-config.js';
import { appendRemotePoolAddressesCommand } from './append-remote-pool-addresses.js';
import { deleteChainConfigCommand } from './delete-chain-config.js';
import { configureAllowListCommand } from './configure-allow-list.js';
import { removeFromAllowListCommand } from './remove-from-allow-list.js';

/**
 * Burnmint Token Pool commands
 */
export function createBurnmintCommands(): Command {
  const burnmintTokenPool = new Command('burnmint-token-pool')
    .description('Burnmint Token Pool Program commands')
    .alias('bm')
    .requiredOption(
      '--instruction <instruction>',
      'Instruction to execute (initialize-pool, accept-ownership, transfer-ownership, init-chain-remote-config, edit-chain-remote-config, set-chain-rate-limit, append-remote-pool-addresses, delete-chain-config, configure-allow-list, remove-from-allow-list)'
    )
    .option(
      '--program-id <programId>',
      'Burnmint token pool program ID (required for all instructions)'
    )
    .option('--mint <mint>', 'Token mint address (required for all instructions)')
    .option('--authority <authority>', 'Authority public key (required for all instructions)')
    // transferOwnership specific options
    .option(
      '--proposed-owner <proposedOwner>',
      'Proposed new owner public key (required for transfer-ownership)'
    )
    // initChainRemoteConfig / editChainRemoteConfig specific options
    .option(
      '--pool-addresses <json>',
      'JSON array of pool addresses (optional; init must be empty; if omitted on edit, existing addresses will be cleared)',
      '[]'
    )
    .option(
      '--token-address <address>',
      'Remote token address (destination chain) as hex string (required for init/edit-chain-remote-config)'
    )
    .option(
      '--decimals <decimals>',
      'Remote token decimals 0-255 (destination chain, required for init/edit-chain-remote-config)'
    )
    // appendRemotePoolAddresses specific options
    .option(
      '--addresses <json>',
      'JSON array of addresses to append (required for append-remote-pool-addresses)'
    )
    // configureAllowList specific options
    .option(
      '--add <json>',
      'JSON array of addresses to add to allow list (required for configure-allow-list)'
    )
    .option(
      '--enabled <boolean>',
      'Enable or disable allow list (true/false, required for configure-allow-list)'
    )
    // removeFromAllowList specific options
    .option(
      '--remove <json>',
      'JSON array of addresses to remove from allow list (required for remove-from-allow-list)'
    )
    // setChainRateLimit specific options
    .option(
      '--remote-chain-selector <selector>',
      'Remote chain selector (required for set-chain-rate-limit)'
    )
    .option(
      '--inbound-enabled <enabled>',
      'Enable inbound rate limiting (true/false, ONLY for set-chain-rate-limit)'
    )
    .option(
      '--inbound-capacity <capacity>',
      'Inbound rate limit capacity in smallest token units (ONLY for set-chain-rate-limit)'
    )
    .option(
      '--inbound-rate <rate>',
      'Inbound rate limit refill rate per second in smallest units (ONLY for set-chain-rate-limit)'
    )
    .option(
      '--outbound-enabled <enabled>',
      'Enable outbound rate limiting (true/false, ONLY for set-chain-rate-limit)'
    )
    .option(
      '--outbound-capacity <capacity>',
      'Outbound rate limit capacity in smallest token units (ONLY for set-chain-rate-limit)'
    )
    .option(
      '--outbound-rate <rate>',
      'Outbound rate limit refill rate per second in smallest units (ONLY for set-chain-rate-limit)'
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
      } else if (options.instruction === 'transfer-ownership') {
        if (!options.proposedOwner) {
          console.error('❌ transfer-ownership instruction requires: --proposed-owner');
          console.error('');
          console.error('Example:');
          console.error('  $ pnpm bs58 burnmint-token-pool --instruction transfer-ownership \\');
          console.error('    --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \\');
          console.error('    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \\');
          console.error('    --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \\');
          console.error('    --proposed-owner "NewOwnerPublicKey123456789..."');
          process.exit(1);
        }
      } else if (options.instruction === 'init-chain-remote-config') {
        const requiredInitChainRemoteConfig = [
          'remoteChainSelector',
          'poolAddresses',
          'tokenAddress',
          'decimals',
        ];

        const missing = requiredInitChainRemoteConfig.filter(opt => !options[opt]);
        if (missing.length > 0) {
          console.error(
            `❌ init-chain-remote-config instruction requires: ${missing.map(opt => `--${opt.replace(/([A-Z])/g, '-$1').toLowerCase()}`).join(', ')}`
          );
          console.error('');
          console.error('Example:');
          console.error(
            '  $ pnpm bs58 burnmint-token-pool --instruction init-chain-remote-config \\'
          );
          console.error('    --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \\');
          console.error('    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \\');
          console.error('    --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \\');
          console.error('    --remote-chain-selector "1234567890" \\');
          console.error('    --pool-addresses \'["0x1234abcd...", "0x5678efgh..."]\' \\');
          console.error('    --token-address "0x9876dcba..." \\');
          console.error('    --decimals "18"');
          process.exit(1);
        }
      } else if (options.instruction === 'edit-chain-remote-config') {
        const requiredEditChainRemoteConfig = [
          'remoteChainSelector',
          'poolAddresses',
          'tokenAddress',
          'decimals',
        ];

        const missing = requiredEditChainRemoteConfig.filter(opt => !options[opt]);
        if (missing.length > 0) {
          console.error(
            `❌ edit-chain-remote-config instruction requires: ${missing.map(opt => `--${opt.replace(/([A-Z])/g, '-$1').toLowerCase()}`).join(', ')}`
          );
          console.error('');
          console.error('Example:');
          console.error(
            '  $ pnpm bs58 burnmint-token-pool --instruction edit-chain-remote-config \\'
          );
          console.error('    --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \\');
          console.error('    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \\');
          console.error('    --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \\');
          console.error('    --remote-chain-selector "1234567890" \\');
          console.error('    --pool-addresses \'["0x1234abcd...", "0x5678efgh..."]\' \\');
          console.error('    --token-address "0x9876dcba..." \\');
          console.error('    --decimals "18"');
          process.exit(1);
        }
      } else if (options.instruction === 'append-remote-pool-addresses') {
        const requiredAppendRemotePoolAddresses = ['remoteChainSelector', 'addresses'];

        const missing = requiredAppendRemotePoolAddresses.filter(opt => !options[opt]);
        if (missing.length > 0) {
          console.error(
            `❌ append-remote-pool-addresses instruction requires: ${missing.map(opt => `--${opt.replace(/([A-Z])/g, '-$1').toLowerCase()}`).join(', ')}`
          );
          console.error('');
          console.error('Example:');
          console.error(
            '  $ pnpm bs58 burnmint-token-pool --instruction append-remote-pool-addresses \\'
          );
          console.error('    --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \\');
          console.error('    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \\');
          console.error('    --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \\');
          console.error('    --remote-chain-selector "1234567890" \\');
          console.error('    --addresses \'["0x1234abcd...", "0x5678efgh..."]\'');
          process.exit(1);
        }
      } else if (options.instruction === 'delete-chain-config') {
        if (!options.remoteChainSelector) {
          console.error('❌ delete-chain-config instruction requires: --remote-chain-selector');
          console.error('');
          console.error('Example:');
          console.error('  $ pnpm bs58 burnmint-token-pool --instruction delete-chain-config \\\\');
          console.error('    --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \\\\');
          console.error('    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \\\\');
          console.error('    --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \\\\');
          console.error('    --remote-chain-selector "1234567890"');
          process.exit(1);
        }
      } else if (options.instruction === 'configure-allow-list') {
        const requiredConfigureAllowList = ['add', 'enabled'];

        const missing = requiredConfigureAllowList.filter(opt => !options[opt]);
        if (missing.length > 0) {
          console.error(
            `❌ configure-allow-list instruction requires: ${missing.map(opt => `--${opt.replace(/([A-Z])/g, '-$1').toLowerCase()}`).join(', ')}`
          );
          console.error('');
          console.error('Example:');
          console.error(
            '  $ pnpm bs58 burnmint-token-pool --instruction configure-allow-list \\\\'
          );
          console.error('    --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \\\\');
          console.error('    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \\\\');
          console.error('    --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \\\\');
          console.error(
            '    --add \'["11111111111111111111111111111112", "22222222222222222222222222222223"]\' \\\\'
          );
          console.error('    --enabled "true"');
          process.exit(1);
        }
      } else if (options.instruction === 'remove-from-allow-list') {
        if (!options.remove) {
          console.error('❌ remove-from-allow-list instruction requires: --remove');
          console.error('');
          console.error('Example:');
          console.error(
            '  $ pnpm bs58 burnmint-token-pool --instruction remove-from-allow-list \\\\'
          );
          console.error('    --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \\\\');
          console.error('    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \\\\');
          console.error('    --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \\\\');
          console.error(
            '    --remove \'["11111111111111111111111111111112", "22222222222222222222222222222223"]\''
          );
          process.exit(1);
        }
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

  # Transfer ownership to a new owner
  $ pnpm bs58 --env devnet burnmint-token-pool \\
    --instruction transfer-ownership \\
    --program-id "BurnMintProgramID123456789..." \\
    --mint "TokenMintAddress123456789..." \\
    --authority "CurrentOwnerPublicKey123456789..." \\
    --proposed-owner "NewOwnerPublicKey123456789..."

  # Initialize remote chain configuration
  $ pnpm bs58 --env devnet burnmint-token-pool \\
    --instruction init-chain-remote-config \\
    --program-id "BurnMintProgramID123456789..." \\
    --mint "TokenMintAddress123456789..." \\
    --authority "AuthorityPublicKey123456789..." \\
    --remote-chain-selector "1234567890" \\
    --token-address "0x9876dcba..." \\
    --decimals "18"

  # Edit existing remote chain configuration
  $ pnpm bs58 --env devnet burnmint-token-pool \\
    --instruction edit-chain-remote-config \\
    --program-id "BurnMintProgramID123456789..." \\
    --mint "TokenMintAddress123456789..." \\
    --authority "AuthorityPublicKey123456789..." \\
    --remote-chain-selector "1234567890" \\
    --pool-addresses '["0x1234abcd...", "0x5678efgh..."]' \\
    --token-address "0x9876dcba..." \\
    --decimals "18"

  # Append addresses to existing remote pool configuration
  $ pnpm bs58 --env devnet burnmint-token-pool \\
    --instruction append-remote-pool-addresses \\
    --program-id "BurnMintProgramID123456789..." \\
    --mint "TokenMintAddress123456789..." \\
    --authority "AuthorityPublicKey123456789..." \\
    --remote-chain-selector "1234567890" \\
    --addresses '["0xnew1234...", "0xnew5678..."]'

  # Delete chain configuration
  $ pnpm bs58 --env devnet burnmint-token-pool \\
    --instruction delete-chain-config \\
    --program-id "BurnMintProgramID123456789..." \\
    --mint "TokenMintAddress123456789..." \\
    --authority "AuthorityPublicKey123456789..." \\
    --remote-chain-selector "1234567890"

  # Configure allow list for addresses
  $ pnpm bs58 --env devnet burnmint-token-pool \\
    --instruction configure-allow-list \\
    --program-id "BurnMintProgramID123456789..." \\
    --mint "TokenMintAddress123456789..." \\
    --authority "AuthorityPublicKey123456789..." \\
    --add '["11111111111111111111111111111112", "22222222222222222222222222222223"]' \\
    --enabled "true"

  # Remove addresses from allow list
  $ pnpm bs58 --env devnet burnmint-token-pool \\
    --instruction remove-from-allow-list \\
    --program-id "BurnMintProgramID123456789..." \\
    --mint "TokenMintAddress123456789..." \\
    --authority "AuthorityPublicKey123456789..." \\
    --remove '["11111111111111111111111111111112", "33333333333333333333333333333334"]'

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

🏗️  Pool Management:
  • initialize-pool              Initialize a new burn-mint token pool
  • accept-ownership             Accept ownership of a token pool
  • transfer-ownership           Transfer ownership to a new owner

⚙️  Chain Configuration (Pool Addresses & Token Info):
  • init-chain-remote-config     Initialize remote chain config (pool addresses, token address, decimals)
  • edit-chain-remote-config     Edit remote chain config (pool addresses, token address, decimals ONLY)
  • append-remote-pool-addresses Append addresses to existing remote pool configuration
  • delete-chain-config          Delete entire chain configuration

🚦 Rate Limiting (Separate from Chain Config):
  • set-chain-rate-limit         Configure inbound/outbound rate limits (must run AFTER init-chain-remote-config)

🛡️  Access Control:
  • configure-allow-list         Configure allowed addresses list
  • remove-from-allow-list       Remove addresses from allowed list

💡 IMPORTANT: Rate limits are separate from chain config! Use init-chain-remote-config first, then set-chain-rate-limit.

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
      if (options.instruction === 'initialize-pool') {
        initializePoolCommand(options, command);
      } else if (options.instruction === 'accept-ownership') {
        acceptOwnershipCommand(options, command);
      } else if (options.instruction === 'transfer-ownership') {
        transferOwnershipCommand(options, command);
      } else if (options.instruction === 'init-chain-remote-config') {
        initChainRemoteConfigCommand(options, command);
      } else if (options.instruction === 'edit-chain-remote-config') {
        editChainRemoteConfigCommand(options, command);
      } else if (options.instruction === 'append-remote-pool-addresses') {
        appendRemotePoolAddressesCommand(options, command);
      } else if (options.instruction === 'delete-chain-config') {
        deleteChainConfigCommand(options, command);
      } else if (options.instruction === 'configure-allow-list') {
        configureAllowListCommand(options, command);
      } else if (options.instruction === 'remove-from-allow-list') {
        removeFromAllowListCommand(options, command);
      } else if (options.instruction === 'set-chain-rate-limit') {
        setChainRateLimitCommand(options, command);
      } else {
        console.error(`❌ Unknown instruction: ${options.instruction}`);
        console.error(
          'Available instructions: initialize-pool, accept-ownership, transfer-ownership, init-chain-remote-config, edit-chain-remote-config, append-remote-pool-addresses, delete-chain-config, configure-allow-list, remove-from-allow-list, set-chain-rate-limit'
        );
        process.exit(1);
      }
    });

  return burnmintTokenPool;
}
