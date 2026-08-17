import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Keypair,
  TransactionInstruction,
  PublicKey,
  SystemProgram,
  type Connection,
} from '@solana/web3.js';
import { executeTransaction, loadKeypair } from '../src/utils/transaction-executor.js';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BLOCKHASH = '11111111111111111111111111111111';

function stubConn(opts: {
  sendResult?: 'success' | 'fail-lag' | 'fail-other' | 'fail-then-success';
  confirmResult?: 'success' | 'fail';
}): Connection {
  let lagCalls = 0;
  const sendRawTransaction = vi.fn(async () => {
    if (opts.sendResult === 'success') return 'sig';
    if (opts.sendResult === 'fail-lag') {
      throw new Error('Simulation failed. custom program error: 0xbc4. AccountNotInitialized.');
    }
    if (opts.sendResult === 'fail-other') {
      throw new Error('Blockhash not found');
    }
    // fail-then-success: fail the first 2 with lag, then succeed
    lagCalls += 1;
    if (lagCalls <= 2) {
      throw new Error('Simulation failed. custom program error: 0xbc4. AccountNotInitialized.');
    }
    return 'sig';
  });
  const confirmTransaction = vi.fn(async () => undefined);
  return {
    getLatestBlockhash: vi
      .fn()
      .mockResolvedValue({ blockhash: BLOCKHASH, lastValidBlockHeight: 150n }),
    sendRawTransaction,
    confirmTransaction,
  } as unknown as Connection;
}

/** An instruction whose only signer is the fee payer (so tx.serialize() succeeds with [signer]). */
function simpleIx(signer: Keypair): TransactionInstruction {
  return SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1,
  });
}

describe('executeTransaction sign-once idempotency', () => {
  it('re-broadcasts the IDENTICAL raw bytes on every retry (same signature)', async () => {
    const conn = stubConn({ sendResult: 'fail-then-success', confirmResult: 'success' });
    const signer = Keypair.generate();
    await executeTransaction(conn, [simpleIx(signer)], [signer]);

    const send = (conn as unknown as { sendRawTransaction: ReturnType<typeof vi.fn> })
      .sendRawTransaction;
    expect(send.mock.calls.length).toBeGreaterThanOrEqual(3);
    const raws = send.mock.calls.map(c => c[0] as Buffer);
    // Every retry must broadcast the same bytes (sign-once ⇒ identical signature ⇒ no double-exec).
    for (let i = 1; i < raws.length; i++) {
      expect(raws[i]!.equals(raws[0]!)).toBe(true);
    }
  });

  it('uses finalized commitment for the blockhash', async () => {
    const conn = stubConn({ sendResult: 'success', confirmResult: 'success' });
    const s = Keypair.generate();
    await executeTransaction(conn, [simpleIx(s)], [s]);
    const getBH = (conn as unknown as { getLatestBlockhash: ReturnType<typeof vi.fn> })
      .getLatestBlockhash;
    expect(getBH).toHaveBeenCalledWith('finalized');
  });

  it('sets preflightCommitment to confirmed and skipPreflight=false', async () => {
    const conn = stubConn({ sendResult: 'success', confirmResult: 'success' });
    const s2 = Keypair.generate();
    await executeTransaction(conn, [simpleIx(s2)], [s2]);
    const send = (conn as unknown as { sendRawTransaction: ReturnType<typeof vi.fn> })
      .sendRawTransaction;
    const opts = send.mock.calls[0]![1] as { preflightCommitment: string; skipPreflight: boolean };
    expect(opts.preflightCommitment).toBe('confirmed');
    expect(opts.skipPreflight).toBe(false);
  });
});

describe('executeTransaction lag-retry budget extension', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('extends the retry budget from 3 to 8 on AccountNotInitialized-shaped errors', async () => {
    const conn = stubConn({ sendResult: 'fail-lag', confirmResult: 'success' });
    const s3 = Keypair.generate();
    const prom = expect(executeTransaction(conn, [simpleIx(s3)], [s3])).rejects.toThrow();
    // Flush the exponential-backoff sleeps (up to 5s each) without real waiting.
    await vi.runAllTimersAsync();
    await prom;
    const send = (conn as unknown as { sendRawTransaction: ReturnType<typeof vi.fn> })
      .sendRawTransaction;
    // 3 would be the default budget; 8 is the extended budget. Must be > 3 and ≤ 8.
    expect(send.mock.calls.length).toBeGreaterThan(3);
    expect(send.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it('does NOT extend the budget for unrelated errors (stops at 3)', async () => {
    const conn = stubConn({ sendResult: 'fail-other', confirmResult: 'success' });
    const s4 = Keypair.generate();
    const prom = expect(executeTransaction(conn, [simpleIx(s4)], [s4])).rejects.toThrow();
    await vi.runAllTimersAsync();
    await prom;
    const send = (conn as unknown as { sendRawTransaction: ReturnType<typeof vi.fn> })
      .sendRawTransaction;
    expect(send.mock.calls.length).toBe(3);
  });
});

describe('executeTransaction guards', () => {
  it('throws when signers is empty', async () => {
    const conn = stubConn({ sendResult: 'success', confirmResult: 'success' });
    await expect(executeTransaction(conn, [simpleIx(Keypair.generate())], [])).rejects.toThrow(
      /At least one signer/
    );
  });
});

describe('loadKeypair', () => {
  it('loads a valid keypair JSON array', () => {
    const kp = Keypair.generate();
    const dir = mkdtempSync(join(tmpdir(), 'test-kp-'));
    const path = join(dir, 'keypair.json');
    writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
    try {
      const loaded = loadKeypair(path);
      expect(loaded.publicKey.equals(kp.publicKey)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a non-array JSON file with a message mentioning the path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'test-kp-bad-'));
    const path = join(dir, 'bad-keypair.json');
    writeFileSync(path, JSON.stringify({ not: 'an array' }));
    try {
      expect(() => loadKeypair(path)).toThrow(/must contain a JSON array/);
      expect(() => loadKeypair(path)).toThrow(path);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
