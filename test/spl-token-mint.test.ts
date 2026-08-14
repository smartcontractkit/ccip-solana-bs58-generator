import { describe, it, expect } from 'vitest';
import { Keypair, PublicKey, SystemProgram, SystemInstruction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMintLen,
  ExtensionType,
  TYPE_SIZE,
  LENGTH_SIZE,
} from '@solana/spl-token';
import { pack } from '@solana/spl-token-metadata';
import type { TokenMetadata } from '@solana/spl-token-metadata';
import { InstructionBuilder } from '../src/programs/spl-token/instructions.js';
import { resolveMetadataBackend } from '../src/commands/spl-token/create-mint.js';
import { SplCreateMultisigArgsSchema } from '../src/types/index.js';

// Rent is the only thing createMintWithSeed needs the network for; stub it deterministically so
// the encoding assertions run offline.
const LAMPORTS_PER_BYTE = 10;
const connection = {
  getMinimumBalanceForRentExemption: async (space: number) => space * LAMPORTS_PER_BYTE,
} as unknown as import('@solana/web3.js').Connection;

const authority = new PublicKey('2SGSoyjD1QLEpL8SsA2Zhc51jRCQPiZ6GjJWZGkvC3V3');
const mint = new PublicKey('BPympxtoS3GZmNcGiTxqsH6kyRgKiS9QFjfviSLaqxRE');
const SEED = 'test-seed';
const MD = { name: 'Test Token', symbol: 'TEST', uri: 'https://example.com/t.json' };

// SPL Token instruction tags used by the assertions below.
const TAG_INITIALIZE_MINT = 0;
const TAG_MINT_TO = 7;
const TAG_APPROVE = 4;
const TAG_SET_AUTHORITY = 6;

const isSystemCreate = (ix: { programId: PublicKey }) =>
  ix.programId.equals(SystemProgram.programId);

describe.each([
  { label: 'spl-token (legacy)', programId: TOKEN_PROGRAM_ID },
  { label: 'token-2022', programId: TOKEN_2022_PROGRAM_ID },
])('$label: shared instruction surface', ({ programId }) => {
  const builder = new InstructionBuilder(programId);

  it('createMintWithSeed builds createAccountWithSeed + InitializeMint, sized for a bare mint', async () => {
    const ixs = await builder.createMintWithSeed(mint, authority, SEED, authority, 9, connection);

    expect(ixs).toHaveLength(2);
    expect(isSystemCreate(ixs[0]!)).toBe(true);
    // Allocated and funded for a mint with no extensions.
    const space = getMintLen([]);
    const decoded = SystemInstruction.decodeCreateWithSeed(ixs[0]!);
    expect(Number(decoded.space)).toBe(space);
    expect(Number(decoded.lamports)).toBe(space * LAMPORTS_PER_BYTE);
    expect(decoded.programId.equals(programId)).toBe(true);

    expect(ixs[1]!.programId.equals(programId)).toBe(true);
    expect(ixs[1]!.data[0]).toBe(TAG_INITIALIZE_MINT);
  });

  it('mintTo targets the right token program and encodes the amount', () => {
    const ix = builder.mintTo(mint, new PublicKey(Keypair.generate().publicKey), authority, 1234n);
    expect(ix.programId.equals(programId)).toBe(true);
    expect(ix.data[0]).toBe(TAG_MINT_TO);
    expect(ix.data.readBigUInt64LE(1)).toBe(1234n);
  });

  it('approve encodes the delegate and amount', () => {
    const delegate = Keypair.generate().publicKey;
    const source = Keypair.generate().publicKey;
    const ix = builder.approve(source, delegate, authority, 500n);
    expect(ix.programId.equals(programId)).toBe(true);
    expect(ix.data[0]).toBe(TAG_APPROVE);
    expect(ix.data.readBigUInt64LE(1)).toBe(500n);
    expect(ix.keys.some(k => k.pubkey.equals(delegate))).toBe(true);
  });

  it('transferMintAuthority targets the right program', () => {
    const next = Keypair.generate().publicKey;
    const ix = builder.transferMintAuthority(mint, authority, next);
    expect(ix.programId.equals(programId)).toBe(true);
    expect(ix.data[0]).toBe(TAG_SET_AUTHORITY);
  });

  it('mintTo through an SPL multisig lists the member signers', () => {
    const member = Keypair.generate().publicKey;
    const multisig = Keypair.generate().publicKey;
    const ix = builder.mintTo(mint, Keypair.generate().publicKey, multisig, 1n, [member]);
    expect(ix.programId.equals(programId)).toBe(true);
    // 4-account multisig form: the member appears as an extra signer alongside the multisig.
    expect(ix.keys.some(k => k.pubkey.equals(member) && k.isSigner)).toBe(true);
    expect(ix.keys.some(k => k.pubkey.equals(multisig))).toBe(true);
  });

  it('createAssociatedTokenAccount derives the ATA for this token program', () => {
    const owner = Keypair.generate().publicKey;
    const ix = builder.createAssociatedTokenAccount(authority, owner, mint);
    expect(ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true);
    // The ATA derivation must include this token program, or the address differs per program.
    expect(ix.keys.some(k => k.pubkey.equals(programId))).toBe(true);
  });
});

describe('token-2022 embedded metadata', () => {
  const builder = new InstructionBuilder(TOKEN_2022_PROGRAM_ID);

  it('orders the instructions createAccount -> MetadataPointer -> InitializeMint -> TokenMetadata', async () => {
    const ixs = await builder.createMintWithSeed(mint, authority, SEED, authority, 9, connection, {
      ...MD,
      updateAuthority: authority,
    });

    expect(ixs).toHaveLength(4);
    expect(isSystemCreate(ixs[0]!)).toBe(true);

    const pointerIdx = 1;
    const initMintIdx = 2;
    const metadataIdx = 3;

    // The pointer extension must be initialized BEFORE InitializeMint...
    expect(ixs[pointerIdx]!.programId.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
    expect(ixs[initMintIdx]!.data[0]).toBe(TAG_INITIALIZE_MINT);
    expect(pointerIdx).toBeLessThan(initMintIdx);

    // ...and the TokenMetadata initialization AFTER it.
    expect(metadataIdx).toBeGreaterThan(initMintIdx);
    expect(ixs[metadataIdx]!.programId.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
    // TokenMetadata uses an 8-byte discriminator, not a 1-byte SPL tag.
    expect(ixs[metadataIdx]!.data.length).toBeGreaterThan(8);
  });

  it('allocates for the pointer extension but funds rent for the packed metadata too', async () => {
    const ixs = await builder.createMintWithSeed(mint, authority, SEED, authority, 9, connection, {
      ...MD,
      updateAuthority: authority,
    });

    const space = getMintLen([ExtensionType.MetadataPointer]);
    const metadata: TokenMetadata = {
      mint,
      name: MD.name,
      symbol: MD.symbol,
      uri: MD.uri,
      additionalMetadata: [],
      updateAuthority: authority,
    };
    const expectedLamports =
      (space + TYPE_SIZE + LENGTH_SIZE + pack(metadata).length) * LAMPORTS_PER_BYTE;

    const decoded = SystemInstruction.decodeCreateWithSeed(ixs[0]!);
    // The account is allocated at the pointer-extension size...
    expect(Number(decoded.space)).toBe(space);
    // ...while lamports cover the metadata the token program appends afterwards.
    expect(Number(decoded.lamports)).toBe(expectedLamports);
    expect(expectedLamports).toBeGreaterThan(space * LAMPORTS_PER_BYTE);
  });

  it('points the metadata at the mint account itself', async () => {
    const ixs = await builder.createMintWithSeed(mint, authority, SEED, authority, 9, connection, {
      ...MD,
      updateAuthority: authority,
    });
    // Both the pointer and the metadata init reference the mint as the metadata address.
    expect(ixs[1]!.keys.some(k => k.pubkey.equals(mint))).toBe(true);
    expect(ixs[3]!.keys.some(k => k.pubkey.equals(mint))).toBe(true);
  });

  it('rejects embedded metadata on the legacy token program', async () => {
    const legacy = new InstructionBuilder(TOKEN_PROGRAM_ID);
    await expect(
      legacy.createMintWithSeed(mint, authority, SEED, authority, 9, connection, {
        ...MD,
        updateAuthority: authority,
      })
    ).rejects.toThrow(/Token-2022/);
  });

  it('legacy mint creation is unchanged when no metadata is requested (regression)', async () => {
    const legacy = new InstructionBuilder(TOKEN_PROGRAM_ID);
    const ixs = await legacy.createMintWithSeed(mint, authority, SEED, authority, 6, connection);
    expect(ixs).toHaveLength(2);
    expect(ixs.every(ix => !ix.programId.equals(TOKEN_2022_PROGRAM_ID))).toBe(true);
  });
});

describe('metadata backend resolution', () => {
  it('defaults to none', () => {
    expect(resolveMetadataBackend({ withMetaplex: false })).toBe('none');
  });

  it('treats --with-metaplex true as metaplex (backwards compatible)', () => {
    expect(resolveMetadataBackend({ withMetaplex: true })).toBe('metaplex');
  });

  it('lets the explicit --metadata flag win over --with-metaplex', () => {
    expect(resolveMetadataBackend({ withMetaplex: true, metadata: 'token-2022' })).toBe(
      'token-2022'
    );
    expect(resolveMetadataBackend({ withMetaplex: false, metadata: 'metaplex' })).toBe('metaplex');
    expect(resolveMetadataBackend({ withMetaplex: true, metadata: 'none' })).toBe('none');
  });
});

describe('create-multisig limits', () => {
  const signers = JSON.stringify([
    '3zXqRZ8Rfx2Deb5WL7mrVm9win759DXbwUMSd4oKMi7T',
    '2SGSoyjD1QLEpL8SsA2Zhc51jRCQPiZ6GjJWZGkvC3V3',
  ]);
  const base = {
    authority: authority.toBase58(),
    mint: mint.toBase58(),
    seed: 's',
    rpcUrl: 'https://api.devnet.solana.com',
  };

  // The token program checks n and m independently and never m <= n, so an over-threshold multisig
  // initializes and is then permanently unusable. SPL multisigs cannot be edited afterwards.
  it('rejects a threshold greater than the signer count', () => {
    const r = SplCreateMultisigArgsSchema.safeParse({ ...base, signers, threshold: '3' });
    expect(r.success).toBe(false);
  });

  it('accepts a threshold within the signer count', () => {
    const r = SplCreateMultisigArgsSchema.safeParse({ ...base, signers, threshold: '2' });
    expect(r.success).toBe(true);
  });

  it('rejects more than 11 signers (MAX_SIGNERS)', () => {
    const many = JSON.stringify(
      Array.from({ length: 12 }, () => Keypair.generate().publicKey.toBase58())
    );
    const r = SplCreateMultisigArgsSchema.safeParse({ ...base, signers: many, threshold: '1' });
    expect(r.success).toBe(false);
  });
});
