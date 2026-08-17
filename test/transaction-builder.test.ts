import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  VersionedTransaction,
  Message,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { TransactionBuilder } from '../src/core/transaction-builder.js';

const PAYER = Keypair.generate().publicKey;
const MINT = Keypair.generate().publicKey;
const AUTHORITY = Keypair.generate().publicKey;

/**
 * Build a TransactionBuilder whose connection returns a fixed blockhash and a configurable
 * simulation result. The build path needs getLatestBlockhash + simulateTransaction.
 */
function stubbedBuilder(simValue: unknown): TransactionBuilder {
  const tb = new TransactionBuilder({ rpcUrl: 'https://example.invalid' });
  const blockhash = '11111111111111111111111111111111';
  const conn = {
    getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash, lastValidBlockHeight: 150n }),
    simulateTransaction: vi.fn().mockResolvedValue({ value: simValue }),
  };
  // @ts-expect-error replacing private connection for the test
  tb.connection = conn;
  return tb;
}

const OK_SIM = { err: null, logs: [], unitsConsumed: 1234 };
const FAIL_SIM = { err: { InstructionError: [0, { Custom: 6002 }] }, logs: ['x'] };

/** Two-instruction tx: [createAccountWithSeed, initializeMultisig] — like create-multisig. */
function twoInstructionTx(): TransactionInstruction[] {
  const newAcct = Keypair.generate().publicKey;
  const createIx = SystemProgram.createAccountWithSeed({
    fromPubkey: PAYER,
    newAccountPubkey: newAcct,
    basePubkey: PAYER,
    seed: 'seed',
    lamports: 1000,
    space: 200,
    programId: SystemProgram.programId,
  });
  // A second instruction with DIFFERENT accounts than the first — this is the point.
  const otherIx = new TransactionInstruction({
    keys: [
      { pubkey: MINT, isSigner: false, isWritable: true },
      { pubkey: AUTHORITY, isSigner: true, isWritable: false },
    ],
    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    data: Buffer.from([7, ...Buffer.alloc(8, 0)]),
  });
  return [createIx, otherIx];
}

describe('account reporting uses the compiled message, not instructions[0].keys', () => {
  it('accounts[] length === legacyMessage.accountKeys.length (not instructions[0].keys.length)', async () => {
    const tb = stubbedBuilder(OK_SIM);
    const ixs = twoInstructionTx();
    const tx = await tb.buildTransaction(ixs, PAYER, 'test');

    // instructions[0] has 2 keys; the compiled message has more (payer + both instructions' keys,
    // deduped). A regression to instructions[0].keys would give 2.
    expect(tx.accounts.length).toBeGreaterThan(2);
  });

  it('accounts[] includes accounts that only appear in the SECOND instruction', async () => {
    const tb = stubbedBuilder(OK_SIM);
    const tx = await tb.buildTransaction(twoInstructionTx(), PAYER, 'test');
    const addrs = tx.accounts.map(a => a.pubkey);
    // MINT and AUTHORITY only appear in the second instruction; they must be in the reported list.
    expect(addrs).toContain(MINT.toBase58());
    expect(addrs).toContain(AUTHORITY.toBase58());
  });

  it('accounts[] includes the fee payer (which is not in any instruction keys)', async () => {
    const tb = stubbedBuilder(OK_SIM);
    const tx = await tb.buildTransaction(twoInstructionTx(), PAYER, 'test');
    expect(tx.accounts.map(a => a.pubkey)).toContain(PAYER.toBase58());
  });

  it('isSigner/isWritable flags come from the compiled message', async () => {
    const tb = stubbedBuilder(OK_SIM);
    const tx = await tb.buildTransaction(twoInstructionTx(), PAYER, 'test');
    const payer = tx.accounts.find(a => a.pubkey === PAYER.toBase58())!;
    expect(payer.isSigner).toBe(true);
    expect(payer.isWritable).toBe(true);
  });

  it('accountSummary counts match accounts[]', async () => {
    const tb = stubbedBuilder(OK_SIM);
    const tx = await tb.buildTransaction(twoInstructionTx(), PAYER, 'test');
    const s = tx.details.accountSummary;
    expect(s.total).toBe(tx.accounts.length);
    expect(s.signers).toBe(tx.accounts.filter(a => a.isSigner).length);
    expect(s.writable).toBe(tx.accounts.filter(a => a.isWritable).length);
    expect(s.readOnly).toBe(tx.accounts.filter(a => !a.isWritable && !a.isSigner).length);
  });
});

describe('details.instructions lists every instruction (not just the first)', () => {
  it('has one entry per instruction with programId, data, accounts', async () => {
    const tb = stubbedBuilder(OK_SIM);
    const ixs = twoInstructionTx();
    const tx = await tb.buildTransaction(ixs, PAYER, 'test');

    expect(tx.details.instructions).toHaveLength(2);
    expect(tx.details.instructions[0]!.programId).toBe(ixs[0]!.programId.toBase58());
    expect(tx.details.instructions[1]!.programId).toBe(ixs[1]!.programId.toBase58());
    expect(tx.details.instructions[0]!.data).toBe(ixs[0]!.data.toString('hex'));
    expect(tx.details.instructions[1]!.accounts).toHaveLength(2);
  });

  it('details.programId/instructionData still describe instruction[0] (back-compat)', async () => {
    const tb = stubbedBuilder(OK_SIM);
    const ixs = twoInstructionTx();
    const tx = await tb.buildTransaction(ixs, PAYER, 'test');
    expect(tx.details.programId).toBe(ixs[0]!.programId.toBase58());
    expect(tx.details.instructionData).toBe(ixs[0]!.data.toString('hex'));
  });
});

describe('encoding consistency (base58/base64/hex)', () => {
  it('all three encodings decode to the same bytes', async () => {
    const tb = stubbedBuilder(OK_SIM);
    const tx = await tb.buildTransaction(twoInstructionTx(), PAYER, 'test');

    const fromB58 = bs58.decode(tx.base58);
    const fromB64 = Buffer.from(tx.base64, 'base64');
    const fromHex = Buffer.from(tx.hex, 'hex');
    expect(Buffer.from(fromB58).equals(fromB64)).toBe(true);
    expect(Buffer.from(fromB58).equals(fromHex)).toBe(true);
  });

  it('the encoded bytes are a LEGACY message (not v0)', async () => {
    const tb = stubbedBuilder(OK_SIM);
    const tx = await tb.buildTransaction(twoInstructionTx(), PAYER, 'test');
    const bytes = bs58.decode(tx.base58);
    const msg = Message.from(bytes);
    // Legacy messages report version 'legacy' (or 0); v0 messages report 'v0' / 0 with a different
    // structure. The key assertion is that this is NOT a v0 message (which would fail to import
    // into Squads).
    expect(msg.version).not.toBe('v0');
    // A v0 message would not deserialize via Message.from (it would throw or produce a different
    // header byte); the fact that Message.from succeeds confirms legacy format.
    expect(msg.header).toBeDefined();
  });
});

describe('simulation result plumbing', () => {
  it('computeUnits is forwarded when the RPC reports it', async () => {
    const tb = stubbedBuilder({ err: null, logs: [], unitsConsumed: 4321 });
    const tx = await tb.buildTransaction(twoInstructionTx(), PAYER, 'test');
    expect(tx.metadata.computeUnits).toBe(4321);
  });

  it('computeUnits falls back to 0 when undefined', async () => {
    const tb = stubbedBuilder({ err: null, logs: [] });
    const tx = await tb.buildTransaction(twoInstructionTx(), PAYER, 'test');
    expect(tx.metadata.computeUnits).toBe(0);
  });

  it('successful simulation sets simulationSuccess=true and no simulationError', async () => {
    const tb = stubbedBuilder(OK_SIM);
    const tx = await tb.buildTransaction(twoInstructionTx(), PAYER, 'test');
    expect(tx.metadata.simulationSuccess).toBe(true);
    expect(tx.metadata.simulationError).toBeUndefined();
  });

  it('failed simulation sets simulationSuccess=false, keeps the error, and STILL encodes', async () => {
    const tb = stubbedBuilder(FAIL_SIM);
    const tx = await tb.buildTransaction(twoInstructionTx(), PAYER, 'test');
    expect(tx.metadata.simulationSuccess).toBe(false);
    expect(tx.metadata.simulationError).toContain('6002');
    // The transaction is still encoded — the caller needs the bytes + the error.
    expect(tx.base58.length).toBeGreaterThan(0);
  });
});

describe('simulateSignedTransaction (sigVerify path)', () => {
  it('returns success:true when the RPC reports no error', async () => {
    const tb = stubbedBuilder({ err: null, logs: [] });
    const signer = Keypair.generate();
    // The instruction must have the signer as a signer so signedTx.sign([signer]) satisfies it.
    const ix = SystemProgram.transfer({
      fromPubkey: signer.publicKey,
      toPubkey: Keypair.generate().publicKey,
      lamports: 1,
    });
    const res = await tb.simulateSignedTransaction([ix], signer.publicKey, signer);
    expect(res.success).toBe(true);
  });

  it('returns success:false with the error stringified when the RPC reports an error', async () => {
    const tb = stubbedBuilder({ err: { InstructionError: [0, { Custom: 1 }] }, logs: [] });
    const signer = Keypair.generate();
    const ix = SystemProgram.transfer({
      fromPubkey: signer.publicKey,
      toPubkey: Keypair.generate().publicKey,
      lamports: 1,
    });
    const res = await tb.simulateSignedTransaction([ix], signer.publicKey, signer);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Custom');
  });
});
