import { Command } from 'commander';
import { deriveAccountsCommand } from './derive-accounts.js';

/**
 * Utility commands for address derivation and account information
 */
export function createUtilsCommands(): Command {
  const utils = new Command('utils')
    .description('Utility commands for address derivation and account information')
    .alias('u')
    .requiredOption('--instruction <instruction>', 'Utility to execute (derive-accounts)')
    .option(
      '--program-type <type>',
      'Program type (burnmint-token-pool, lockrelease-token-pool, router, spl-token)'
    )
    .option('--program-id <programId>', 'Program ID (required for most derivations)')
    .option('--mint <mint>', 'Token mint address (required for token-specific derivations)')
    .option('--pool-program-id <pubkey>', 'Pool program ID (for router derivations)')
    .option(
      '--remote-chain-selector <selector>',
      'Remote chain selector (for chain config derivations)'
    )
    .addHelpText(
      'after',
      `
Examples:
  # Derive all burnmint token pool accounts
  pnpm bs58 utils --instruction derive-accounts \\
    --program-type burnmint-token-pool \\
    --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \\
    --mint "EbrEbzXXUGurxRq55xtie1r4e8rHH99jUAwUaEygrKND"

  # Derive all lockrelease token pool accounts
  pnpm bs58 utils --instruction derive-accounts \\
    --program-type lockrelease-token-pool \\
    --program-id "8eqh8wppT9c5rw4ERqNCffvU6cNFJWff9WmkcYtmGiqC" \\
    --mint "EbrEbzXXUGurxRq55xtie1r4e8rHH99jUAwUaEygrKND"

  # Derive router accounts  
  pnpm bs58 utils --instruction derive-accounts \\
    --program-type router \\
    --program-id "Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C" \\
    --mint "EbrEbzXXUGurxRq55xtie1r4e8rHH99jUAwUaEygrKND"

Available Program Types:
  • burnmint-token-pool      Derive pool state, pool signer, chain config PDAs
  • lockrelease-token-pool   Derive pool state, pool signer, liquidity account PDAs
  • router                   Derive token admin registry, external pool signer PDAs  
  • spl-token                Derive ATAs and token-related addresses

💡 Tips:
  • Pool Signer PDA is the critical address for cross-chain token operations
  • All addresses are deterministically derived from program + mint + seeds
  • Use --remote-chain-selector to also derive chain-specific config accounts
`
    )
    .action((options, command) => {
      // Route to the appropriate utility handler
      if (options.instruction === 'derive-accounts') {
        return deriveAccountsCommand(options, command);
      }

      console.error(`❌ Unknown utility instruction: ${options.instruction}`);
      process.exit(1);
    });

  return utils;
}
