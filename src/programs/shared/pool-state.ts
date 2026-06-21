import { PublicKey } from '@solana/web3.js';

/**
 * On-chain token pool State account (shared layout for burnmint and lockrelease pools).
 */
export interface PoolStateAccount {
  version: number;
  config: {
    tokenProgram: PublicKey;
    mint: PublicKey;
    decimals: number;
    poolSigner: PublicKey;
    poolTokenAccount: PublicKey;
    owner: PublicKey;
    proposedOwner: PublicKey;
    rateLimitAdmin: PublicKey;
    routerOnrampAuthority: PublicKey;
    router: PublicKey;
    rebalancer?: PublicKey;
    canAcceptLiquidity?: boolean;
    listEnabled: boolean;
    allowList: PublicKey[];
    rmnRemote: PublicKey;
  };
}

/**
 * Manually deserialize a pool State account.
 *
 * Avoids BorshAccountsCoder issues with incomplete IDL types; the byte layout must stay in sync with
 * the on-chain Rust program. Shared by `get-state` and `inspect-token`.
 *
 * @param data - Raw account data buffer from the blockchain
 */
export function deserializePoolState(data: Buffer): PoolStateAccount {
  let offset = 8; // Skip 8-byte Anchor discriminator

  // Read version (u8)
  const version = data.readUInt8(offset);
  offset += 1;

  // Read BaseConfig fields
  const tokenProgram = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const mint = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const decimals = data.readUInt8(offset);
  offset += 1;

  const poolSigner = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const poolTokenAccount = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const owner = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const proposedOwner = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const rateLimitAdmin = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const routerOnrampAuthority = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const router = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const rebalancer = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const canAcceptLiquidity = data.readUInt8(offset) === 1;
  offset += 1;

  const listEnabled = data.readUInt8(offset) === 1;
  offset += 1;

  // Read Vec<Pubkey> for allowList
  const allowListLength = data.readUInt32LE(offset);
  offset += 4;

  const allowList: PublicKey[] = [];
  for (let i = 0; i < allowListLength; i++) {
    allowList.push(new PublicKey(data.subarray(offset, offset + 32)));
    offset += 32;
  }

  const rmnRemote = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  return {
    version,
    config: {
      tokenProgram,
      mint,
      decimals,
      poolSigner,
      poolTokenAccount,
      owner,
      proposedOwner,
      rateLimitAdmin,
      routerOnrampAuthority,
      router,
      rebalancer,
      canAcceptLiquidity,
      listEnabled,
      allowList,
      rmnRemote,
    },
  };
}
