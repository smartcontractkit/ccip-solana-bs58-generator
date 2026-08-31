import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  emitJson,
  emitJsonError,
  transactionEnvelope,
  stateEnvelope,
  toJsonSafe,
  keyOrNull,
  getGlobalOptions,
  isJsonMode,
  redirectChatterToStderr,
  installJsonExitHook,
} from '../src/utils/json-output.js';
import type { GeneratedTransaction } from '../src/types/index.js';
import type { CommandContext, GlobalCommandOptions } from '../src/types/command.js';
import { createRequire } from 'node:module';

// Read the version rather than hardcoding it: a hardcoded literal fails on every release bump.
const { version: PKG_VERSION } = createRequire(import.meta.url)('../package.json') as {
  version: string;
};

const PK = new PublicKey('2SGSoyjD1QLEpL8SsA2Zhc51jRCQPiZ6GjJWZGkvC3V3');

function fakeTx(overrides: Partial<GeneratedTransaction> = {}): GeneratedTransaction {
  return {
    instruction: 'test',
    base58: 'b58',
    base64: 'b64',
    hex: '686578',
    accounts: [{ pubkey: PK.toBase58(), isSigner: true, isWritable: false }],
    details: {
      programId: PK.toBase58(),
      instructionData: '00',
      instructions: [{ programId: PK.toBase58(), data: '00', accounts: [] }],
      signers: [PK.toBase58()],
      writableAccounts: [],
      readOnlyAccounts: [],
      feePayer: PK.toBase58(),
      accountSummary: { total: 1, signers: 1, writable: 0, readOnly: 0 },
    },
    metadata: {
      generatedAt: '2026-01-01T00:00:00.000Z',
      computeUnits: 100,
      simulationSuccess: true,
    },
    ...overrides,
  };
}

describe('transactionEnvelope', () => {
  const globalOptions = { environment: 'devnet', resolvedRpcUrl: 'https://api.devnet.solana.com' };

  it('carries ok, cliVersion, network, kind:"transaction"', () => {
    const env = transactionEnvelope({
      tx: fakeTx(),
      instructionName: 'accept-ownership',
      format: 'base58',
      globalOptions,
      execution: null,
    });
    expect(env.ok).toBe(true);
    expect(env.cliVersion).toBe(PKG_VERSION);
    expect(env.kind).toBe('transaction');
    expect(env.network).toEqual({ env: 'devnet', rpcUrl: 'https://api.devnet.solana.com' });
  });

  it('includes all three encodings regardless of --format', () => {
    const env = transactionEnvelope({
      tx: fakeTx(),
      instructionName: 'x',
      format: 'base64',
      globalOptions,
      execution: null,
    });
    expect(env.encodings).toEqual({ base58: 'b58', base64: 'b64', hex: '686578' });
    // transaction field holds the requested format's blob
    expect(env.transaction).toBe('b64');
  });

  it('transaction field is base58 when format=base58', () => {
    const env = transactionEnvelope({
      tx: fakeTx(),
      instructionName: 'x',
      format: 'base58',
      globalOptions,
      execution: null,
    });
    expect(env.transaction).toBe('b58');
  });

  it('execution block is falsey/null when not executed', () => {
    const env = transactionEnvelope({
      tx: fakeTx(),
      instructionName: 'x',
      format: 'base58',
      globalOptions,
      execution: null,
    });
    expect(env.execution).toEqual({
      executed: false,
      signature: null,
      signer: null,
      explorerUrl: null,
    });
  });

  it('execution block is filled when executed', () => {
    const env = transactionEnvelope({
      tx: fakeTx(),
      instructionName: 'x',
      format: 'base58',
      globalOptions,
      execution: {
        signature: 'sig',
        signer: PK.toBase58(),
        explorerUrl: 'https://explorer.solana.com/tx/sig?cluster=devnet',
      },
    });
    expect(env.execution).toEqual({
      executed: true,
      signature: 'sig',
      signer: PK.toBase58(),
      explorerUrl: 'https://explorer.solana.com/tx/sig?cluster=devnet',
    });
  });

  it('simulation block maps metadata with null fallbacks', () => {
    const env = transactionEnvelope({
      tx: fakeTx({
        metadata: {
          generatedAt: 't',
          computeUnits: 0,
          simulationSuccess: false,
          simulationError: 'boom',
        },
      }),
      instructionName: 'x',
      format: 'base58',
      globalOptions,
      execution: null,
    });
    expect(env.simulation).toEqual({ success: false, computeUnits: 0, error: 'boom' });
  });

  it('simulation block uses null when fields absent', () => {
    const env = transactionEnvelope({
      // Omit simulationSuccess/simulationError entirely so the envelope falls back to null.
      tx: fakeTx({ metadata: { generatedAt: 't', computeUnits: 0 } }),
      instructionName: 'x',
      format: 'base58',
      globalOptions,
      execution: null,
    });
    const sim = env.simulation as { success: unknown; computeUnits: unknown; error: unknown };
    expect(sim.success).toBeNull();
    expect(sim.computeUnits).toBe(0);
    expect(sim.error).toBeNull();
  });
});

describe('stateEnvelope', () => {
  it('sets kind and spreads data alongside envelope base', () => {
    const env = stateEnvelope({
      kind: 'pool-state',
      globalOptions: { environment: 'mainnet', resolvedRpcUrl: 'u' },
      data: { programType: 'burnmint-token-pool', x: 1 },
    });
    expect(env.ok).toBe(true);
    expect(env.kind).toBe('pool-state');
    expect(env.x).toBe(1);
    expect(env.network).toEqual({ env: 'mainnet', rpcUrl: 'u' });
  });
});

describe('toJsonSafe', () => {
  it('converts PublicKey to base58', () => {
    expect(toJsonSafe(PK)).toBe(PK.toBase58());
  });

  it('converts bigint to decimal string', () => {
    expect(toJsonSafe(1234n)).toBe('1234');
  });

  it('converts BN to string', () => {
    // BN is not a direct dependency; mimic its toString() shape (the only thing toJsonSafe calls).
    const fakeBn = { constructor: { name: 'BN' }, toString: () => '99' };
    expect(toJsonSafe(fakeBn)).toBe('99');
  });

  it('converts Buffer to base64', () => {
    const buf = Buffer.from([0xde, 0xad]);
    expect(toJsonSafe(buf)).toBe(buf.toString('base64'));
  });

  it('JSON.stringify does not throw on bigint (the whole point)', () => {
    expect(() => JSON.stringify(toJsonSafe({ a: 1n }))).not.toThrow();
    expect(JSON.parse(JSON.stringify(toJsonSafe({ a: 1n }))).a).toBe('1');
  });

  it('null/undefined pass through as null', () => {
    expect(toJsonSafe(null)).toBeNull();
    expect(toJsonSafe(undefined)).toBeNull();
  });

  it('recurses into arrays and objects', () => {
    const out = toJsonSafe({ keys: [PK], nested: { n: 5n } }) as {
      keys: string[];
      nested: { n: string };
    };
    expect(out.keys[0]).toBe(PK.toBase58());
    expect(out.nested.n).toBe('5');
  });
});

describe('keyOrNull', () => {
  it('maps the all-zero key to null', () => {
    expect(keyOrNull(PublicKey.default.toBase58())).toBeNull();
    expect(keyOrNull(PublicKey.default)).toBeNull();
  });

  it('leaves real keys as base58', () => {
    expect(keyOrNull(PK.toBase58())).toBe(PK.toBase58());
  });

  it('null/undefined in ⇒ null out', () => {
    expect(keyOrNull(null)).toBeNull();
    expect(keyOrNull(undefined)).toBeNull();
  });
});

describe('emitJson / emitJsonError', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });
  afterEach(() => writeSpy.mockRestore());

  it('emitJson writes exactly one JSON document ending in newline', () => {
    emitJson({ hello: 'world' });
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const written = writeSpy.mock.calls[0]![0] as string;
    expect(written.endsWith('\n')).toBe(true);
    expect(JSON.parse(written)).toEqual({ hello: 'world' });
  });

  it('emitJsonError writes ok:false with the error message', () => {
    emitJsonError(new Error('boom'), { context: 1 });
    const written = writeSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(written);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe('boom');
    expect(parsed.context).toBe(1);
  });
});

describe('getGlobalOptions / isJsonMode (Commander nesting)', () => {
  // Minimal command shapes matching CommandContext's parent chain.
  function cmdTwoLevels(opts: GlobalCommandOptions): CommandContext {
    return { parent: { opts: () => opts, parent: { opts: () => opts } } };
  }
  function cmdOneLevel(opts: GlobalCommandOptions): CommandContext {
    return { parent: { opts: () => opts } };
  }

  it('reads opts two levels up', () => {
    const command = cmdTwoLevels({ json: true });
    expect(getGlobalOptions(command).json).toBe(true);
    expect(isJsonMode(command)).toBe(true);
  });

  it('falls back one level up when two levels up is absent', () => {
    const command = cmdOneLevel({ json: true });
    expect(getGlobalOptions(command).json).toBe(true);
    expect(isJsonMode(command)).toBe(true);
  });

  it('returns {} when no parent', () => {
    const command: CommandContext = { parent: null };
    expect(getGlobalOptions(command)).toEqual({});
    expect(isJsonMode(command)).toBe(false);
  });
});

describe('redirectChatterToStderr', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let origLog: typeof console.log;
  let origInfo: typeof console.info;
  let origErr: typeof console.error;

  beforeEach(() => {
    origLog = console.log;
    origInfo = console.info;
    origErr = console.error;
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    console.log = origLog;
    console.info = origInfo;
    console.error = origErr;
    stdoutSpy.mockRestore();
  });

  it('console.log goes to stderr, not stdout', () => {
    // After redirect, console.log is bound to the original console.error. Spy on that bound target
    // by replacing console.error BEFORE redirect runs; redirect captures `console.error.bind(console)`
    // at call time, so the spy is what console.log ends up calling.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    redirectChatterToStderr();
    console.log('chatter');
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe('installJsonExitHook', () => {
  // exit hooks are process-global and hard to isolate; assert the function is callable and
  // idempotent without actually emitting process events.
  it('is callable without throwing', () => {
    expect(() => installJsonExitHook()).not.toThrow();
  });
});
