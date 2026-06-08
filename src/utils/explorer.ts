import type { Connection } from '@solana/web3.js';
import { SOLANA_GENESIS_HASHES, type SolanaEnvironment } from './constants.js';

const SOLANA_EXPLORER_BASE_URL = 'https://explorer.solana.com';

/**
 * Authoritatively infer the cluster from an RPC connection via its genesis hash. This is
 * provider-agnostic (works for private RPCs like Helius/Alchemy/QuickNode) and never inspects the
 * RPC URL, so it cannot leak API keys embedded in the URL.
 *
 * @returns the matching cluster, or `undefined` for localhost / unknown custom validators.
 */
export async function resolveClusterByGenesisHash(
  connection: Connection
): Promise<SolanaEnvironment | undefined> {
  const hash = await connection.getGenesisHash();
  const match = (
    Object.keys(SOLANA_GENESIS_HASHES) as Array<keyof typeof SOLANA_GENESIS_HASHES>
  ).find(env => SOLANA_GENESIS_HASHES[env] === hash);
  return match;
}

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
