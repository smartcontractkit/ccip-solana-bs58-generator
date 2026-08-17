import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { AccountDerivation as BurnmintDerivation } from '../src/programs/burnmint-token-pool/accounts.js';
import { AccountDerivation as LockreleaseDerivation } from '../src/programs/lockrelease-token-pool/accounts.js';
import { AccountDerivation as RouterDerivation } from '../src/programs/router/accounts.js';
import {
  BURNMINT_TOKEN_POOL,
  LOCKRELEASE_TOKEN_POOL,
  ROUTER_SEEDS,
} from '../src/utils/constants.js';

// Fixed, arbitrary inputs so addresses are reproducible.
const PROGRAM_ID = new PublicKey('3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo');
const MINT = new PublicKey('EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo');
// Ethereum mainnet selector — a real value, and one whose LE bytes are not all-zero/trivial.
const ETH_SELECTOR = 1601528660175788095n;
// A second selector to catch endianness regressions (different high/low bytes).
const OTHER_SELECTOR = 12532609583862916510n;

describe('burnmint PDA seeds (AGENTS.md invariants)', () => {
  it('state PDA seeds = ["ccip_tokenpool_config", mint]', () => {
    const [got] = BurnmintDerivation.deriveStatePda(PROGRAM_ID, MINT);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from(BURNMINT_TOKEN_POOL.STATE_SEED), MINT.toBuffer()],
      PROGRAM_ID
    );
    expect(got.equals(expected)).toBe(true);
    // The seed string itself is the invariant — pin it so a rename is caught.
    expect(BURNMINT_TOKEN_POOL.STATE_SEED).toBe('ccip_tokenpool_config');
  });

  it('chainConfig PDA seeds = ["ccip_tokenpool_chainconfig", u64LE(selector), mint]', () => {
    for (const selector of [ETH_SELECTOR, OTHER_SELECTOR]) {
      const [got] = BurnmintDerivation.deriveChainConfigPda(PROGRAM_ID, MINT, selector);
      const buf = Buffer.alloc(8);
      buf.writeBigUInt64LE(selector);
      const [expected] = PublicKey.findProgramAddressSync(
        [Buffer.from(BURNMINT_TOKEN_POOL.CHAIN_CONFIG_SEED), buf, MINT.toBuffer()],
        PROGRAM_ID
      );
      expect(got.equals(expected)).toBe(true);
    }
    expect(BURNMINT_TOKEN_POOL.CHAIN_CONFIG_SEED).toBe('ccip_tokenpool_chainconfig');
  });

  it('poolSigner PDA seeds = ["ccip_tokenpool_signer", mint]', () => {
    const [got] = BurnmintDerivation.derivePoolSignerPda(PROGRAM_ID, MINT);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from(BURNMINT_TOKEN_POOL.POOL_SIGNER_SEED), MINT.toBuffer()],
      PROGRAM_ID
    );
    expect(got.equals(expected)).toBe(true);
    expect(BURNMINT_TOKEN_POOL.POOL_SIGNER_SEED).toBe('ccip_tokenpool_signer');
  });

  it('globalConfig PDA seeds = ["config"]', () => {
    const [got] = BurnmintDerivation.deriveGlobalConfigPda(PROGRAM_ID);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from(BURNMINT_TOKEN_POOL.CONFIG_SEED)],
      PROGRAM_ID
    );
    expect(got.equals(expected)).toBe(true);
    expect(BURNMINT_TOKEN_POOL.CONFIG_SEED).toBe('config');
  });

  it('programData PDA seeds = [programId] under the upgradeable loader', () => {
    const [got] = BurnmintDerivation.deriveProgramDataPda(PROGRAM_ID);
    const [expected] = PublicKey.findProgramAddressSync(
      [PROGRAM_ID.toBuffer()],
      new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')
    );
    expect(got.equals(expected)).toBe(true);
  });
});

describe('lockrelease PDA seeds (shared with burnmint)', () => {
  it('state/chainConfig/poolSigner use the SAME seeds as burnmint', () => {
    expect(LOCKRELEASE_TOKEN_POOL.STATE_SEED).toBe(BURNMINT_TOKEN_POOL.STATE_SEED);
    expect(LOCKRELEASE_TOKEN_POOL.CHAIN_CONFIG_SEED).toBe(BURNMINT_TOKEN_POOL.CHAIN_CONFIG_SEED);
    expect(LOCKRELEASE_TOKEN_POOL.POOL_SIGNER_SEED).toBe(BURNMINT_TOKEN_POOL.POOL_SIGNER_SEED);

    // Same inputs ⇒ same addresses across both programs' derivation classes (the programId differs
    // in practice, but the derivation logic must agree).
    const [bState] = BurnmintDerivation.deriveStatePda(PROGRAM_ID, MINT);
    const [lState] = LockreleaseDerivation.deriveStatePda(PROGRAM_ID, MINT);
    expect(lState.equals(bState)).toBe(true);

    const [bCfg] = BurnmintDerivation.deriveChainConfigPda(PROGRAM_ID, MINT, ETH_SELECTOR);
    const [lCfg] = LockreleaseDerivation.deriveChainConfigPda(PROGRAM_ID, MINT, ETH_SELECTOR);
    expect(lCfg.equals(bCfg)).toBe(true);

    const [bSigner] = BurnmintDerivation.derivePoolSignerPda(PROGRAM_ID, MINT);
    const [lSigner] = LockreleaseDerivation.derivePoolSignerPda(PROGRAM_ID, MINT);
    expect(lSigner.equals(bSigner)).toBe(true);
  });

  it('derivePoolTokenAccount = ATA(poolSigner, mint, tokenProgram) for both token programs', () => {
    const [poolSigner] = LockreleaseDerivation.derivePoolSignerPda(PROGRAM_ID, MINT);
    for (const tokenProgram of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
      const got = LockreleaseDerivation.derivePoolTokenAccount(
        PROGRAM_ID,
        allowUndefined(MINT),
        tokenProgram
      );
      const expected = getAssociatedTokenAddressSync(MINT, poolSigner, true, tokenProgram);
      expect(got.equals(expected)).toBe(true);
    }
  });
});

// `getAssociatedTokenAddressSync` wants a PublicKey; the derivation method signature takes PublicKey
// directly. This helper just passes through so the loop stays readable.
function allowUndefined(pk: PublicKey): PublicKey {
  return pk;
}

describe('router PDA seeds', () => {
  it('config PDA seeds = ["config"]', () => {
    const [got] = RouterDerivation.deriveConfigPda(PROGRAM_ID);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from(ROUTER_SEEDS.CONFIG)],
      PROGRAM_ID
    );
    expect(got.equals(expected)).toBe(true);
    expect(ROUTER_SEEDS.CONFIG).toBe('config');
  });

  it('tokenAdminRegistry PDA seeds = ["token_admin_registry", mint]', () => {
    const [got] = RouterDerivation.deriveTokenAdminRegistryPda(PROGRAM_ID, MINT);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from(ROUTER_SEEDS.TOKEN_ADMIN_REGISTRY), MINT.toBuffer()],
      PROGRAM_ID
    );
    expect(got.equals(expected)).toBe(true);
    expect(ROUTER_SEEDS.TOKEN_ADMIN_REGISTRY).toBe('token_admin_registry');
  });

  it('externalTokenPoolsSigner PDA seeds = ["external_token_pools_signer", poolProgramId]', () => {
    // A valid base58 placeholder (the on-chain burnmint program id is 32 bytes; this is just a
    // deterministic stand-in for the derivation check).
    const poolProgramId = new PublicKey('BurnMintCcipTokenPoo1xxxxxxxxxxxxxxxxxxxxxxx');
    const [got] = RouterDerivation.deriveExternalTokenPoolsSignerPda(PROGRAM_ID, poolProgramId);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from(ROUTER_SEEDS.EXTERNAL_TOKEN_POOLS_SIGNER), poolProgramId.toBuffer()],
      PROGRAM_ID
    );
    expect(got.equals(expected)).toBe(true);
    expect(ROUTER_SEEDS.EXTERNAL_TOKEN_POOLS_SIGNER).toBe('external_token_pools_signer');
  });
});

describe('PDA determinism', () => {
  it('same inputs ⇒ same address and bump', () => {
    const [a1, b1] = BurnmintDerivation.deriveStatePda(PROGRAM_ID, MINT);
    const [a2, b2] = BurnmintDerivation.deriveStatePda(PROGRAM_ID, MINT);
    expect(a1.equals(a2)).toBe(true);
    expect(b1).toBe(b2);
  });

  it('different mint ⇒ different state PDA', () => {
    const other = new PublicKey('BPympxtoS3GZmNcGiTxqsH6kyRgKiS9QFjfviSLaqxRE');
    const [a] = BurnmintDerivation.deriveStatePda(PROGRAM_ID, MINT);
    const [b] = BurnmintDerivation.deriveStatePda(PROGRAM_ID, other);
    expect(a.equals(b)).toBe(false);
  });
});
