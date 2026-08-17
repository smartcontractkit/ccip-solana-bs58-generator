import { describe, it, expect, vi } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  TransactionBuilder,
  isAccountNotInitialized,
  isAccountNotInitializedError,
  ACCOUNT_LAG_RETRIES,
} from '../src/core/transaction-builder.js';

// A simulation that reports AccountNotInitialized may mean the RPC node has not replayed the slot
// in which the account was created, rather than that the account is missing. These tests pin the
// retry behaviour and, crucially, that a genuinely missing account is still reported.

const NOT_INITIALIZED = {
  err: { InstructionError: [0, { Custom: 3012 }] },
  logs: ['Program log: AnchorError caused by account: state. Error Code: AccountNotInitialized.'],
};
const OTHER_FAILURE = {
  err: { InstructionError: [0, { Custom: 6002 }] },
  logs: ['Program log: AnchorError caused by account: authority. Error Code: Unauthorized.'],
};
const OK = { err: null, logs: [], unitsConsumed: 1234 };

describe('isAccountNotInitialized', () => {
  it('detects the Anchor custom error code', () => {
    expect(isAccountNotInitialized({ err: NOT_INITIALIZED.err })).toBe(true);
  });

  it('detects it from the program logs alone', () => {
    expect(
      isAccountNotInitialized({ err: { InstructionError: [0, 'x'] }, logs: NOT_INITIALIZED.logs })
    ).toBe(true);
  });

  it('does not fire on a successful simulation', () => {
    expect(isAccountNotInitialized({ err: null, logs: [] })).toBe(false);
  });

  it('does not fire on an unrelated program error', () => {
    expect(isAccountNotInitialized(OTHER_FAILURE)).toBe(false);
  });
});

/** Build a TransactionBuilder whose connection returns the given simulation results in order. */
function builderReturning(results: unknown[]) {
  const tb = new TransactionBuilder({ rpcUrl: 'https://example.invalid' });
  const simulate = vi.fn();
  for (const value of results) simulate.mockResolvedValueOnce({ value });
  // last result repeats if called again
  simulate.mockResolvedValue({ value: results[results.length - 1] });
  // @ts-expect-error - replacing the private connection for the test
  tb.connection = { simulateTransaction: simulate };
  return { tb, simulate };
}

// simulateTransaction is private; exercise it directly rather than through the whole build path,
// which would need a live RPC for the blockhash.
const simulateVia = async (tb: TransactionBuilder) =>
  // @ts-expect-error - private method under test
  tb.simulateTransaction({} as never);

describe('simulation retries on RPC lag', () => {
  it('retries and succeeds once the node catches up', async () => {
    const { tb, simulate } = builderReturning([NOT_INITIALIZED, NOT_INITIALIZED, OK]);
    const result = await simulateVia(tb);
    expect(simulate).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
    expect(result.unitsConsumed).toBe(1234);
  });

  it('gives up after the retry budget and still reports the failure', async () => {
    const { tb, simulate } = builderReturning([NOT_INITIALIZED]);
    const result = await simulateVia(tb);
    expect(simulate).toHaveBeenCalledTimes(ACCOUNT_LAG_RETRIES + 1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('3012');
  });

  it('does not retry an unrelated failure', async () => {
    const { tb, simulate } = builderReturning([OTHER_FAILURE]);
    const result = await simulateVia(tb);
    expect(simulate).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
  });

  it('does not retry a successful simulation', async () => {
    const { tb, simulate } = builderReturning([OK]);
    await simulateVia(tb);
    expect(simulate).toHaveBeenCalledTimes(1);
  });
});

// The send path sees the same condition as a thrown SendTransactionError carrying preflight logs.
describe('isAccountNotInitializedError (send path)', () => {
  const real =
    'Simulation failed. Message: Transaction simulation failed: Error processing Instruction 0: ' +
    'custom program error: 0xbc4. Logs: ["Program log: AnchorError caused by account: mint. ' +
    'Error Code: AccountNotInitialized. Error Number: 3012."]';

  it('detects the real SendTransactionError text', () => {
    expect(isAccountNotInitializedError(real)).toBe(true);
  });

  it('detects the bare hex code', () => {
    expect(isAccountNotInitializedError('custom program error: 0xbc4')).toBe(true);
  });

  it('does not fire on an unrelated send failure', () => {
    expect(isAccountNotInitializedError('Blockhash not found')).toBe(false);
    expect(isAccountNotInitializedError('custom program error: 0x1772')).toBe(false);
  });
});
