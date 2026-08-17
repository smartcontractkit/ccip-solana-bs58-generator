import { PublicKey } from '@solana/web3.js';

/**
 * The pool program's global config PDA, seeds `["config"]`.
 *
 * Program-wide, not per-token. The program's upgrade authority can always initialize a pool; with
 * `selfServedAllowed` set, a token's own mint authority can initialize one too. `router` and
 * `rmnRemote` are the defaults a newly initialized pool inherits, so an existing pool may hold
 * something else.
 */
export interface PoolConfigAccount {
  version: number;
  selfServedAllowed: boolean;
  router: PublicKey;
  rmnRemote: PublicKey;
}

/**
 * Deserialize the global config account.
 *
 * Layout after the 8-byte Anchor discriminator: u8 version, bool self_served_allowed, then the
 * router and rmn_remote Pubkeys. Hand-maintained against `PoolConfig` in the pool program, for the
 * reason `pool-state.ts` gives.
 */
export function deserializePoolConfig(data: Buffer): PoolConfigAccount {
  const EXPECTED = 8 + 1 + 1 + 32 + 32;
  if (data.length < EXPECTED) {
    throw new Error(`Pool config account is ${data.length} bytes, expected at least ${EXPECTED}`);
  }
  let o = 8;
  const version = data.readUInt8(o);
  o += 1;
  const selfServedAllowed = data.readUInt8(o) === 1;
  o += 1;
  const router = new PublicKey(data.subarray(o, o + 32));
  o += 32;
  const rmnRemote = new PublicKey(data.subarray(o, o + 32));
  return { version, selfServedAllowed, router, rmnRemote };
}
