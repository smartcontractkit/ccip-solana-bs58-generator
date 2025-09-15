import { PublicKey } from '@solana/web3.js';
/**
 * Solana environments and their RPC endpoints
 */
export const SOLANA_ENVIRONMENTS = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  localhost: 'http://localhost:8899',
} as const;

export type SolanaEnvironment = keyof typeof SOLANA_ENVIRONMENTS;

/**
 * @deprecated Use SOLANA_ENVIRONMENTS instead
 */
export const DEFAULT_RPC_ENDPOINTS = {
  MAINNET: SOLANA_ENVIRONMENTS.mainnet,
  DEVNET: SOLANA_ENVIRONMENTS.devnet,
  TESTNET: SOLANA_ENVIRONMENTS.testnet,
  LOCALHOST: SOLANA_ENVIRONMENTS.localhost,
} as const;

/**
 * Default transaction configuration
 */
export const DEFAULT_TRANSACTION_CONFIG = {
  COMMITMENT: 'confirmed',
} as const;

/**
 * CLI configuration constants
 */
export const CLI_CONFIG = {
  NAME: 'ccip-bs58',
  DESCRIPTION: 'CLI for generating BS58 transaction data from Solana burnmint_token_pool IDL',
  VERSION: '1.0.0',
} as const;

/**
 * Burnmint Token Pool specific constants
 */
export const BURNMINT_TOKEN_POOL = {
  STATE_SEED: 'ccip_tokenpool_config',
  CHAIN_CONFIG_SEED: 'ccip_tokenpool_chainconfig',
  POOL_SIGNER_SEED: 'ccip_tokenpool_signer',
  CONFIG_SEED: 'config',
} as const;

/**
 * Lockrelease Token Pool specific constants
 */
export const LOCKRELEASE_TOKEN_POOL = {
  STATE_SEED: 'ccip_tokenpool_config',
  CHAIN_CONFIG_SEED: 'ccip_tokenpool_chainconfig',
  POOL_SIGNER_SEED: 'ccip_tokenpool_signer',
  CONFIG_SEED: 'config',
} as const;

/**
 * CCIP Router specific seeds
 */
export const ROUTER_SEEDS = {
  CONFIG: 'config',
  TOKEN_ADMIN_REGISTRY: 'token_admin_registry',
  EXTERNAL_TOKEN_POOLS_SIGNER: 'external_token_pools_signer',
} as const;

/**
 * Fee Quoter specific seeds
 */
export const FEE_QUOTER_SEEDS = {
  FEE_BILLING_TOKEN_CONFIG: 'fee_billing_token_config',
} as const;

/**
 * Well-known program IDs
 */
export const PROGRAM_IDS = {
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID: new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'),
} as const;
