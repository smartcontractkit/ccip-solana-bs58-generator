import { Command } from 'commander';
import { initializePoolCommand } from './initialize-pool.js';
import { acceptOwnershipCommand } from './accept-ownership.js';
import { getChainConfigCommand } from './get-chain-config.js';
import { getStateCommand } from './get-state.js';
import { transferOwnershipCommand } from './transfer-ownership.js';
import { setRateLimitAdminCommand } from './set-rate-limit-admin.js';
import { configureAllowListCommand } from './configure-allow-list.js';
import { removeFromAllowListCommand } from './remove-from-allow-list.js';
import { initChainRemoteConfigCommand } from './init-chain-remote-config.js';
import { editChainRemoteConfigCommand } from './edit-chain-remote-config.js';
import { deleteChainConfigCommand } from './delete-chain-config.js';
import { appendRemotePoolAddressesCommand } from './append-remote-pool-addresses.js';
import { setChainRateLimitCommand } from './set-chain-rate-limit.js';
import { provideLiquidityCommand } from './provide-liquidity.js';
import { withdrawLiquidityCommand } from './withdraw-liquidity.js';
import { setRebalancerCommand } from './set-rebalancer.js';
import { setCanAcceptLiquidityCommand } from './set-can-accept-liquidity.js';

/**
 * Lock/Release Token Pool commands
 */
export function createLockReleaseCommands(): Command {
  const lockrelease = new Command('lockrelease-token-pool')
    .description('Lock/Release Token Pool Program commands')
    .alias('lr')
    .requiredOption(
      '--instruction <instruction>',
      'Instruction to execute (initialize-pool, accept-ownership, transfer-ownership, set-rate-limit-admin, get-state, get-chain-config, init-chain-remote-config, edit-chain-remote-config, set-chain-rate-limit, append-remote-pool-addresses, delete-chain-config, configure-allow-list, remove-from-allow-list, provide-liquidity, withdraw-liquidity, set-rebalancer, set-can-accept-liquidity)'
    )
    .option(
      '--program-id <programId>',
      'Lockrelease token pool program ID (required for all instructions)'
    )
    .option('--mint <mint>', 'Token mint address (required for all instructions)')
    .option('--authority <authority>', 'Authority address (required for all instructions)')

    // transferOwnership specific options
    .option(
      '--proposed-owner <proposedOwner>',
      'Proposed new owner public key (required for transfer-ownership)'
    )

    // setRateLimitAdmin specific options
    .option(
      '--new-rate-limit-admin <newRateLimitAdmin>',
      'New rate limit admin public key (required for set-rate-limit-admin)'
    )

    // initChainRemoteConfig / editChainRemoteConfig specific options
    .option(
      '--pool-addresses <json>',
      'JSON array of pool addresses (optional; init must be empty; if omitted on edit, existing addresses will be cleared)',
      '[]'
    )
    .option(
      '--token-address <address>',
      'Remote token address (required for init/edit-chain-remote-config)'
    )
    .option('--decimals <decimals>', 'Token decimals (required for init/edit-chain-remote-config)')
    .option(
      '--remote-chain-selector <selector>',
      'Remote chain selector (required for chain config operations)'
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
      '--enabled <enabled>',
      'Enable allow list (true/false) (required for configure-allow-list)'
    )

    // removeFromAllowList specific options
    .option(
      '--remove <json>',
      'JSON array of addresses to remove from allow list (required for remove-from-allow-list)'
    )

    // setChainRateLimit specific options
    .option(
      '--inbound-enabled <enabled>',
      'Enable inbound rate limiting (true/false) (required for set-chain-rate-limit)'
    )
    .option(
      '--inbound-capacity <capacity>',
      'Inbound rate limit capacity (required for set-chain-rate-limit)'
    )
    .option(
      '--inbound-rate <rate>',
      'Inbound rate limit refill rate per second (required for set-chain-rate-limit)'
    )
    .option(
      '--outbound-enabled <enabled>',
      'Enable outbound rate limiting (true/false) (required for set-chain-rate-limit)'
    )
    .option(
      '--outbound-capacity <capacity>',
      'Outbound rate limit capacity (required for set-chain-rate-limit)'
    )
    .option(
      '--outbound-rate <rate>',
      'Outbound rate limit refill rate per second (required for set-chain-rate-limit)'
    )

    // Liquidity operations specific options
    .option(
      '--amount <amount>',
      'Amount to provide/withdraw (in smallest token units) (required for provide/withdraw-liquidity)'
    )

    // setRebalancer specific options
    .option('--rebalancer <rebalancer>', 'Rebalancer address (required for set-rebalancer)')

    // setCanAcceptLiquidity specific options
    .option(
      '--allow <allow>',
      'Allow liquidity operations (true/false) (required for set-can-accept-liquidity)'
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
      if (!options.programId || !options.mint) {
        console.error('❌ All instructions require: --program-id and --mint');
        process.exit(1);
      }

      // Most instructions also require --authority (except read-only operations)
      const readOnlyInstructions = ['get-state', 'get-chain-config'];
      if (!readOnlyInstructions.includes(options.instruction) && !options.authority) {
        console.error('❌ This instruction requires: --authority');
        console.error(
          `💡 Read-only operations (${readOnlyInstructions.join(', ')}) do not require --authority`
        );
        process.exit(1);
      }
    })
    .addHelpText(
      'after',
      `
Examples:
  # Initialize pool
  pnpm bs58 lockrelease-token-pool --env devnet \\
    --instruction initialize-pool \\
    --program-id "8eqh8wppT9c5rw4ERqNCffvU6cNFJWff9WmkcYtmGiqC" \\
    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \\
    --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY"

  # Set rebalancer
  pnpm bs58 lockrelease-token-pool --env devnet \\
    --instruction set-rebalancer \\
    --program-id "8eqh8wppT9c5rw4ERqNCffvU6cNFJWff9WmkcYtmGiqC" \\
    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \\
    --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \\
    --rebalancer "RebalancerAddress123456789..."

  # Provide liquidity
  pnpm bs58 lockrelease-token-pool --env devnet \\
    --instruction provide-liquidity \\
    --program-id "8eqh8wppT9c5rw4ERqNCffvU6cNFJWff9WmkcYtmGiqC" \\
    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \\
    --authority "RebalancerAddress123456789..." \\
    --amount "1000000000"

  # Withdraw liquidity
  pnpm bs58 lockrelease-token-pool --env devnet \\
    --instruction withdraw-liquidity \\
    --program-id "8eqh8wppT9c5rw4ERqNCffvU6cNFJWff9WmkcYtmGiqC" \\
    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \\
    --authority "RebalancerAddress123456789..." \\
    --amount "500000000"

Available Instructions:
  • initialize-pool              Initialize the pool state
  • accept-ownership             Accept ownership transfer
  • transfer-ownership           Transfer pool ownership
  • set-rate-limit-admin         Set the rate limit admin for a token pool
  • get-state                    Read and display the current state of a token pool
  • get-chain-config             Read and display chain configuration and rate limits for a remote chain
  • init-chain-remote-config     Initialize remote chain configuration
  • edit-chain-remote-config     Edit existing remote chain configuration
  • append-remote-pool-addresses Append addresses to remote pool config
  • delete-chain-config          Delete chain configuration
  • configure-allow-list         Configure allow list
  • remove-from-allow-list       Remove from allow list
  • set-chain-rate-limit         Set rate limits for a chain
  • provide-liquidity            Provide liquidity to pool (rebalancer only)
  • withdraw-liquidity           Withdraw liquidity from pool (rebalancer only)
  • set-rebalancer               Set the pool rebalancer (owner only)
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
      } else if (options.instruction === 'set-rate-limit-admin') {
        setRateLimitAdminCommand(options, command);
      } else if (options.instruction === 'get-state') {
        getStateCommand(options, command);
      } else if (options.instruction === 'get-chain-config') {
        getChainConfigCommand(options, command);
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
      } else if (options.instruction === 'provide-liquidity') {
        provideLiquidityCommand(options, command);
      } else if (options.instruction === 'withdraw-liquidity') {
        withdrawLiquidityCommand(options, command);
      } else if (options.instruction === 'set-rebalancer') {
        setRebalancerCommand(options, command);
      } else if (options.instruction === 'set-can-accept-liquidity') {
        setCanAcceptLiquidityCommand(options, command);
      } else {
        console.error(`❌ Unknown instruction: ${options.instruction}`);
        console.error(
          'Available instructions: initialize-pool, accept-ownership, transfer-ownership, set-rate-limit-admin, get-state, get-chain-config, init-chain-remote-config, edit-chain-remote-config, append-remote-pool-addresses, delete-chain-config, configure-allow-list, remove-from-allow-list, set-chain-rate-limit, provide-liquidity, withdraw-liquidity, set-rebalancer, set-can-accept-liquidity'
        );
        process.exit(1);
      }
    });

  return lockrelease;
}

export {
  initializePoolCommand,
  acceptOwnershipCommand,
  getChainConfigCommand,
  getStateCommand,
  transferOwnershipCommand,
  setRateLimitAdminCommand,
  configureAllowListCommand,
  removeFromAllowListCommand,
  initChainRemoteConfigCommand,
  editChainRemoteConfigCommand,
  deleteChainConfigCommand,
  appendRemotePoolAddressesCommand,
  setChainRateLimitCommand,
  provideLiquidityCommand,
  withdrawLiquidityCommand,
  setRebalancerCommand,
};
