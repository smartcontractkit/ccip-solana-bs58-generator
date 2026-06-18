import os from 'os';
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
 * Well-known, fixed genesis hashes per Solana cluster. Used to authoritatively infer the cluster
 * from any RPC connection (provider-agnostic), e.g. when only --rpc-url is given.
 */
export const SOLANA_GENESIS_HASHES: Record<'mainnet' | 'devnet' | 'testnet', string> = {
  mainnet: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
  devnet: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
  testnet: '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY',
};

/**
 * Get RPC URL for a given environment
 * @param env - Environment name (mainnet, devnet, testnet, localhost)
 * @returns RPC URL string
 * @throws Error if environment is invalid
 */
export function getRpcUrl(env: string): string {
  if (env in SOLANA_ENVIRONMENTS) {
    return SOLANA_ENVIRONMENTS[env as SolanaEnvironment];
  }
  throw new Error(
    `Invalid environment: ${env}. Must be one of: ${Object.keys(SOLANA_ENVIRONMENTS).join(', ')}`
  );
}

/**
 * Default Solana CLI keypair path
 */
export const DEFAULT_KEYPAIR_PATH = `${os.homedir()}/.config/solana/id.json`;

/**
 * Default transaction configuration
 */
export const DEFAULT_TRANSACTION_CONFIG = {
  COMMITMENT: 'confirmed',
} as const;

/**
 * Supported transaction output encodings for multisig import
 */
export const TRANSACTION_OUTPUT_FORMATS = ['base58', 'base64'] as const;

export type TransactionOutputFormat = (typeof TRANSACTION_OUTPUT_FORMATS)[number];

export const DEFAULT_TRANSACTION_OUTPUT_FORMAT: TransactionOutputFormat = 'base58';

/** Shell env var for default transaction output format (e.g. `export CCIP_TX_OUTPUT_FORMAT=base64`) */
export const TX_OUTPUT_FORMAT_ENV_VAR = 'CCIP_TX_OUTPUT_FORMAT';

export function parseTransactionOutputFormat(
  value: string | undefined
): TransactionOutputFormat | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  return TRANSACTION_OUTPUT_FORMATS.includes(normalized as TransactionOutputFormat)
    ? (normalized as TransactionOutputFormat)
    : null;
}

export type TransactionOutputFormatResolution =
  | { ok: true; format: TransactionOutputFormat }
  | { ok: false; source: 'cli' | 'env'; value: string };

/**
 * Resolve output format with precedence: CLI `--format` > `CCIP_TX_OUTPUT_FORMAT` env > base58 default.
 */
export function resolveTransactionOutputFormat(
  cliFormat?: string
): TransactionOutputFormatResolution {
  if (cliFormat !== undefined && cliFormat !== '') {
    const parsed = parseTransactionOutputFormat(cliFormat);
    if (!parsed) {
      return { ok: false, source: 'cli', value: cliFormat };
    }
    return { ok: true, format: parsed };
  }

  const envValue = process.env[TX_OUTPUT_FORMAT_ENV_VAR];
  if (envValue !== undefined && envValue !== '') {
    const parsed = parseTransactionOutputFormat(envValue);
    if (!parsed) {
      return { ok: false, source: 'env', value: envValue };
    }
    return { ok: true, format: parsed };
  }

  return { ok: true, format: DEFAULT_TRANSACTION_OUTPUT_FORMAT };
}

export function getEncodedTransactionData(
  transaction: { base58: string; base64: string },
  format: TransactionOutputFormat = DEFAULT_TRANSACTION_OUTPUT_FORMAT
): string {
  return format === 'base64' ? transaction.base64 : transaction.base58;
}

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
