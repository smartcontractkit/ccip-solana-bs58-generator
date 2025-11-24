import type { SolanaEnvironment } from './constants.js';

const SOLANA_EXPLORER_BASE_URL = 'https://explorer.solana.com';

function getClusterQuery(env: SolanaEnvironment): string {
  if (env === 'mainnet') {
    return '';
  }

  if (env === 'devnet' || env === 'testnet') {
    return `?cluster=${env}`;
  }

  // Localhost and any custom RPCs are not directly supported by the public explorer.
  // Default to mainnet explorer without cluster query.
  return '';
}

export function getTransactionExplorerUrl(signature: string, env: SolanaEnvironment): string {
  const cluster = getClusterQuery(env);
  return `${SOLANA_EXPLORER_BASE_URL}/tx/${signature}${cluster}`;
}
export function getAddressExplorerUrl(address: string, env: SolanaEnvironment): string {
  const cluster = getClusterQuery(env);
  return `${SOLANA_EXPLORER_BASE_URL}/address/${address}${cluster}`;
}
