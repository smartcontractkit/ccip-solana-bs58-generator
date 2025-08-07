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
} as const;
