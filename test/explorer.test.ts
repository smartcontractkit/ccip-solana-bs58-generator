import { describe, it, expect, vi } from 'vitest';
import { PublicKey, type Connection } from '@solana/web3.js';
import {
  getTransactionExplorerUrl,
  getAddressExplorerUrl,
  resolveClusterByGenesisHash,
} from '../src/utils/explorer.js';
import { SOLANA_GENESIS_HASHES } from '../src/utils/constants.js';

const SIG = '5xK...signature';
const ADDR = PublicKey.default.toBase58();

describe('explorer URL cluster query', () => {
  it('mainnet has no ?cluster= query', () => {
    expect(getTransactionExplorerUrl(SIG, 'mainnet')).toBe(`https://explorer.solana.com/tx/${SIG}`);
  });

  it('devnet and testnet get ?cluster=', () => {
    expect(getTransactionExplorerUrl(SIG, 'devnet')).toBe(
      `https://explorer.solana.com/tx/${SIG}?cluster=devnet`
    );
    expect(getTransactionExplorerUrl(SIG, 'testnet')).toBe(
      `https://explorer.solana.com/tx/${SIG}?cluster=testnet`
    );
  });

  it('getAddressExplorerUrl mirrors the tx url shape', () => {
    expect(getAddressExplorerUrl(ADDR, 'mainnet')).toBe(
      `https://explorer.solana.com/address/${ADDR}`
    );
    expect(getAddressExplorerUrl(ADDR, 'devnet')).toBe(
      `https://explorer.solana.com/address/${ADDR}?cluster=devnet`
    );
  });
});

describe('resolveClusterByGenesisHash', () => {
  function connReturning(hash: string) {
    return {
      getGenesisHash: vi.fn().mockResolvedValue(hash),
    } as unknown as Connection;
  }

  it('maps each known hash to its env', async () => {
    for (const env of ['mainnet', 'devnet', 'testnet'] as const) {
      const got = await resolveClusterByGenesisHash(connReturning(SOLANA_GENESIS_HASHES[env]));
      expect(got).toBe(env);
    }
  });

  it('returns undefined for an unknown / localhost hash', async () => {
    const got = await resolveClusterByGenesisHash(
      connReturning('unknownhash000000000000000000000000000000000000000000000')
    );
    expect(got).toBeUndefined();
  });

  it('the genesis hash table has exactly mainnet/devnet/testnet', () => {
    expect(Object.keys(SOLANA_GENESIS_HASHES).sort()).toEqual(['devnet', 'mainnet', 'testnet']);
  });
});
