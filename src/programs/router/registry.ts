import { PublicKey } from '@solana/web3.js';

/**
 * Decoded CCIP Token Admin Registry account.
 *
 * The router IDL bundled in this repo does not include this account layout, so it is decoded by
 * byte offset. The layout must stay in sync with the on-chain Rust program.
 */
export interface TokenAdminRegistry {
  version: number;
  administrator: PublicKey;
  pendingAdministrator: PublicKey;
  lookupTable: PublicKey;
  /** Account indexes (into the ALT) that are marked writable for set_pool. */
  writableIndexes: number[];
  mint: PublicKey;
}

/**
 * Decode the `writable_indexes` region ([u128; 2], 32 bytes) into a sorted list of account indexes.
 *
 * Encoding (verified on-chain against a known set-pool of [3,4,7]): each u128 is a bitmap where the
 * MOST significant bit corresponds to index 0, i.e. account index `i` is stored at bit `127 - i` of
 * its word. Word 0 (bytes 0-15) covers indexes 0-127; word 1 (bytes 16-31) covers 128-255.
 */
export function decodeWritableIndexes(buf: Buffer): number[] {
  const indexes: number[] = [];
  for (let b = 0; b < 32; b++) {
    const byte = buf[b] ?? 0;
    for (let i = 0; i < 8; i++) {
      if (byte & (1 << i)) {
        const bitPos = (b % 16) * 8 + i; // position within the u128 (0-127)
        const index = b < 16 ? 127 - bitPos : 255 - bitPos;
        indexes.push(index);
      }
    }
  }
  return indexes.sort((a, b) => a - b);
}

/**
 * Manually deserialize a Token Admin Registry account.
 * Layout: 8 disc | version u8 | administrator(32) | pending_administrator(32) | lookup_table(32) |
 * writable_indexes [u128;2] (32) | mint(32).
 */
export function deserializeTokenAdminRegistry(data: Buffer): TokenAdminRegistry {
  const pk = (offset: number): PublicKey => new PublicKey(data.subarray(offset, offset + 32));
  return {
    version: data.readUInt8(8),
    administrator: pk(9),
    pendingAdministrator: pk(41),
    lookupTable: pk(73),
    writableIndexes: decodeWritableIndexes(data.subarray(105, 137) as Buffer),
    mint: pk(137),
  };
}
