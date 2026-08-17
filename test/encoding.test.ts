import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { createHash } from 'crypto';
import { AnchorUtils } from '../src/utils/anchor.js';
import {
  hexToBytes,
  hexToPadded32Bytes,
  normalizeHexString,
  leftPad,
} from '../src/utils/addresses.js';
import { InstructionBuilder as BurnmintBuilder } from '../src/programs/burnmint-token-pool/instructions.js';
import burnmintIdl from '../src/programs/burnmint-token-pool/idl.json' with { type: 'json' };
import type { Idl } from '../src/types/index.js';

const PROGRAM_ID = new PublicKey('3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo');
const MINT = new PublicKey('EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo');
const AUTHORITY = new PublicKey('59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY');
const ETH_SELECTOR = 1601528660175788095n;

const idl = burnmintIdl as unknown as Idl;
const builder = new BurnmintBuilder(PROGRAM_ID, idl);

/** sha256("global:<name>")[0..8] — the Anchor discriminator invariant. */
function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

describe('Anchor discriminator invariant', () => {
  it.each([
    'initialize',
    'accept_ownership',
    'transfer_ownership',
    'set_rate_limit_admin',
    'set_chain_rate_limit',
    'init_chain_remote_config',
    'edit_chain_remote_config',
    'append_remote_pool_addresses',
    'delete_chain_config',
    'configure_allow_list',
    'remove_from_allow_list',
  ])('discriminator("%s") === sha256("global:%s")[0..8]', name => {
    const got = AnchorUtils.calculateDiscriminator(name);
    const expected = disc(name);
    expect(got.equals(expected)).toBe(true);
    expect(got.length).toBe(8);
  });
});

describe('hex/address helpers', () => {
  it('normalizeHexString strips 0x and lowercases', () => {
    expect(normalizeHexString('0xABCDEF')).toBe('abcdef');
    expect(normalizeHexString('ABCDEF')).toBe('abcdef');
    expect(normalizeHexString('0xabcdef')).toBe('abcdef');
  });

  it('hexToBytes accepts 0x-prefix and rejects non-hex', () => {
    expect(hexToBytes('0xdeadbeef').toString('hex')).toBe('deadbeef');
    expect(hexToBytes('deadbeef').toString('hex')).toBe('deadbeef');
    expect(() => hexToBytes('zz')).toThrow(/Invalid hex/);
  });

  it('hexToPadded32Bytes left-pads to 32 bytes', () => {
    const out = hexToPadded32Bytes('0x1234');
    expect(out.length).toBe(32);
    expect(out[30]).toBe(0x12);
    expect(out[31]).toBe(0x34);
    // over-32 throws
    expect(() => hexToPadded32Bytes('0x' + 'ab'.repeat(33))).toThrow();
  });

  it('leftPad throws when buffer longer than target', () => {
    expect(() => leftPad(Buffer.from([1, 2, 3]), 2)).toThrow(/longer than/);
  });
});

describe('transferOwnership instruction data', () => {
  it('data = disc(8) + proposedOwner(32), 40 bytes total', async () => {
    const proposedOwner = new PublicKey('BPympxtoS3GZmNcGiTxqsH6kyRgKiS9QFjfviSLaqxRE');
    const ix = await builder.transferOwnership(MINT, AUTHORITY, proposedOwner);
    expect(ix.data.length).toBe(40);
    expect(ix.data.subarray(0, 8).equals(disc('transfer_ownership'))).toBe(true);
    expect(ix.data.subarray(8, 40).equals(proposedOwner.toBuffer())).toBe(true);
  });
});

describe('setChainRateLimit instruction data', () => {
  it('layout: disc(8) + selector(8 LE) + mint(32) + inbound{1+8+8} + outbound{1+8+8} = 82 bytes', async () => {
    const inbound = { enabled: true, capacity: 1000n, rate: 10n };
    const outbound = { enabled: false, capacity: 500n, rate: 5n };
    const ix = await builder.setChainRateLimit(MINT, AUTHORITY, ETH_SELECTOR, inbound, outbound);
    expect(ix.data.length).toBe(82);

    let o = 0;
    expect(ix.data.subarray(o, o + 8).equals(disc('set_chain_rate_limit'))).toBe(true);
    o += 8;
    expect(ix.data.readBigUInt64LE(o)).toBe(ETH_SELECTOR);
    o += 8;
    expect(ix.data.subarray(o, o + 32).equals(MINT.toBuffer())).toBe(true);
    o += 32;
    // inbound
    expect(ix.data.readUInt8(o)).toBe(1);
    o += 1;
    expect(ix.data.readBigUInt64LE(o)).toBe(1000n);
    o += 8;
    expect(ix.data.readBigUInt64LE(o)).toBe(10n);
    o += 8;
    // outbound
    expect(ix.data.readUInt8(o)).toBe(0);
    o += 1;
    expect(ix.data.readBigUInt64LE(o)).toBe(500n);
    o += 8;
    expect(ix.data.readBigUInt64LE(o)).toBe(5n);
    o += 8;
    expect(o).toBe(82);
  });
});

describe('initChainRemoteConfig instruction data', () => {
  it('empty pool list: disc(8) + selector(8 LE) + mint(32) + vecLen(4=0) + tokenAddr{len(4)+32} + decimals(1)', async () => {
    const tokenAddress = '0x9876dcba';
    const decimals = 18;
    const ix = await builder.initChainRemoteConfig(
      MINT,
      AUTHORITY,
      ETH_SELECTOR,
      [],
      tokenAddress,
      decimals
    );

    let o = 0;
    expect(ix.data.subarray(o, o + 8).equals(disc('init_chain_remote_config'))).toBe(true);
    o += 8;
    expect(ix.data.readBigUInt64LE(o)).toBe(ETH_SELECTOR);
    o += 8;
    expect(ix.data.subarray(o, o + 32).equals(MINT.toBuffer())).toBe(true);
    o += 32;
    // vec len = 0
    expect(ix.data.readUInt32LE(o)).toBe(0);
    o += 4;
    // token address: length prefix (32) then 32 left-padded bytes
    expect(ix.data.readUInt32LE(o)).toBe(32);
    o += 4;
    expect(ix.data.subarray(o, o + 32).equals(hexToPadded32Bytes(tokenAddress))).toBe(true);
    o += 32;
    expect(ix.data.readUInt8(o)).toBe(18);
    o += 1;
    expect(o).toBe(ix.data.length);
  });

  it('two pool addresses: each is len(4) + bytes, in order', async () => {
    const addrs = ['0x1234', '0xdeadbeef'];
    const ix = await builder.initChainRemoteConfig(
      MINT,
      AUTHORITY,
      ETH_SELECTOR,
      addrs,
      '0xabcd',
      6
    );

    // skip disc(8) + selector(8) + mint(32)
    let o = 8 + 8 + 32;
    expect(ix.data.readUInt32LE(o)).toBe(2);
    o += 4;
    for (const a of addrs) {
      const bytes = hexToBytes(a);
      expect(ix.data.readUInt32LE(o)).toBe(bytes.length);
      o += 0;
      o += 4;
      expect(ix.data.subarray(o, o + bytes.length).equals(bytes)).toBe(true);
      o += bytes.length;
    }
  });
});

describe('appendRemotePoolAddresses instruction data', () => {
  it('layout: disc(8) + selector(8 LE) + mint(32) + vec of RemoteAddress', async () => {
    const addrs = ['0x1234', '0x5678', '0x9abc'];
    const ix = await builder.appendRemotePoolAddresses(MINT, AUTHORITY, ETH_SELECTOR, addrs);

    expect(ix.data.subarray(0, 8).equals(disc('append_remote_pool_addresses'))).toBe(true);
    expect(ix.data.readBigUInt64LE(8)).toBe(ETH_SELECTOR);
    expect(ix.data.subarray(16, 48).equals(MINT.toBuffer())).toBe(true);
    expect(ix.data.readUInt32LE(48)).toBe(3);

    let o = 52;
    for (const a of addrs) {
      const bytes = hexToBytes(a);
      expect(ix.data.readUInt32LE(o)).toBe(bytes.length);
      o += 4;
      expect(ix.data.subarray(o, o + bytes.length).equals(bytes)).toBe(true);
      o += bytes.length;
    }
    expect(o).toBe(ix.data.length);
  });
});

describe('account metas for built instructions', () => {
  it('initChainRemoteConfig accounts: [state(RO), chainConfig(W), authority(W,signer), system(RO)]', async () => {
    const ix = await builder.initChainRemoteConfig(MINT, AUTHORITY, ETH_SELECTOR, [], '0xab', 6);
    expect(ix.keys).toHaveLength(4);
    expect(ix.keys[0]!.isWritable).toBe(false); // state RO
    expect(ix.keys[1]!.isWritable).toBe(true); // chainConfig W
    expect(ix.keys[2]!.isWritable).toBe(true); // authority W
    expect(ix.keys[2]!.isSigner).toBe(true); // authority signer
    expect(ix.keys[3]!.pubkey.equals(new PublicKey('11111111111111111111111111111111'))).toBe(true); // system
  });

  it('all built instructions target the burnmint program id', async () => {
    const ixs = [
      await builder.acceptOwnership(MINT, AUTHORITY),
      await builder.transferOwnership(
        MINT,
        AUTHORITY,
        new PublicKey('BPympxtoS3GZmNcGiTxqsH6kyRgKiS9QFjfviSLaqxRE')
      ),
    ];
    for (const ix of ixs) expect(ix.programId.equals(PROGRAM_ID)).toBe(true);
  });
});
