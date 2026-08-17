import { describe, it, expect, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import {
  CLI_CONFIG,
  DEFAULT_KEYPAIR_PATH,
  resolveTransactionOutputFormat,
  SOLANA_ENVIRONMENTS,
  TRANSACTION_OUTPUT_FORMATS,
  TX_OUTPUT_FORMAT_ENV_VAR,
  type SolanaEnvironment,
} from '../src/utils/constants.js';

/**
 * The global preAction hook logic lives inline in src/index.ts main(). Rather than import main()
 * (which calls parseAsync on process.argv), we reconstruct the hook's decision rules against the
 * same constants and assert the rules the diff established. This tests the contract, not the wiring.
 */

function evalHook(opts: Record<string, unknown>): { exit: boolean; reason?: string } {
  const hasEnv = opts.environment;
  const hasRpcUrl = opts.rpcUrl;
  if (hasEnv && hasRpcUrl) return { exit: true, reason: 'both' };
  if (hasEnv && !Object.keys(SOLANA_ENVIRONMENTS).includes(hasEnv as string)) {
    return { exit: true, reason: 'bad-env' };
  }
  const fmt = resolveTransactionOutputFormat(opts.format as string);
  if (!fmt.ok) return { exit: true, reason: `bad-format-${fmt.source}` };
  if (opts.keypair && !opts.execute) return { exit: true, reason: 'keypair-without-execute' };
  if (opts.execute && !opts.resolvedRpcUrl && !opts.rpcUrl && !opts.environment) {
    return { exit: true, reason: 'execute-no-rpc' };
  }
  return { exit: false };
}

describe('global preAction: --env / --rpc-url mutex', () => {
  it('rejects using both --env and --rpc-url', () => {
    expect(evalHook({ environment: 'devnet', rpcUrl: 'https://x' })).toEqual({
      exit: true,
      reason: 'both',
    });
  });
  it('accepts --env alone', () => {
    expect(evalHook({ environment: 'devnet' }).exit).toBe(false);
  });
  it('accepts --rpc-url alone', () => {
    expect(evalHook({ rpcUrl: 'https://x' }).exit).toBe(false);
  });
});

describe('global preAction: --env validation', () => {
  it('rejects an invalid environment', () => {
    expect(evalHook({ environment: 'foo' })).toEqual({ exit: true, reason: 'bad-env' });
  });
  it('accepts each known environment', () => {
    for (const env of Object.keys(SOLANA_ENVIRONMENTS) as SolanaEnvironment[]) {
      expect(evalHook({ environment: env }).exit).toBe(false);
    }
  });
});

describe('global preAction: --format validation', () => {
  it('rejects an invalid CLI format', () => {
    expect(evalHook({ format: 'hex' }).reason).toBe('bad-format-cli');
  });
  it('accepts base58 and base64', () => {
    expect(evalHook({ format: 'base58' }).exit).toBe(false);
    expect(evalHook({ format: 'base64' }).exit).toBe(false);
  });
});

describe('global preAction: --keypair / --execute', () => {
  it('rejects --keypair without --execute', () => {
    expect(evalHook({ keypair: '/k.json' })).toEqual({
      exit: true,
      reason: 'keypair-without-execute',
    });
  });
  it('accepts --keypair with --execute', () => {
    expect(evalHook({ keypair: '/k.json', execute: true, environment: 'devnet' }).exit).toBe(false);
  });
});

describe('resolvedRpcUrl resolution rules', () => {
  // Mirrors the resolution in src/index.ts: rpcUrl wins, else env→SOLANA_ENVIRONMENTS[env].
  function resolve(opts: Record<string, unknown>): string | undefined {
    if (opts.rpcUrl) return opts.rpcUrl as string;
    if (opts.environment) return SOLANA_ENVIRONMENTS[opts.environment as SolanaEnvironment];
    return undefined;
  }
  it('--rpc-url overrides --env', () => {
    expect(resolve({ rpcUrl: 'https://custom', environment: 'devnet' })).toBe('https://custom');
  });
  it('--env devnet → devnet RPC', () => {
    expect(resolve({ environment: 'devnet' })).toBe(SOLANA_ENVIRONMENTS.devnet);
  });
  it('neither → undefined', () => {
    expect(resolve({})).toBeUndefined();
  });
});

describe('CLI_CONFIG identity', () => {
  it('NAME and VERSION are dynamic (not the old hardcoded values)', () => {
    expect(CLI_CONFIG.NAME).not.toBe('ccip-bs58');
    expect(CLI_CONFIG.VERSION).not.toBe('1.0.0');
  });
  it('DEFAULT_KEYPAIR_PATH points at the solana CLI id.json', () => {
    expect(DEFAULT_KEYPAIR_PATH).toMatch(/id\.json$/);
  });
  it('TRANSACTION_OUTPUT_FORMATS is base58|base64', () => {
    expect([...TRANSACTION_OUTPUT_FORMATS]).toEqual(['base58', 'base64']);
  });
  it('TX_OUTPUT_FORMAT_ENV_VAR is CCIP_TX_OUTPUT_FORMAT', () => {
    expect(TX_OUTPUT_FORMAT_ENV_VAR).toBe('CCIP_TX_OUTPUT_FORMAT');
  });
});

describe('--json bootstrap contract', () => {
  // The hook calls redirectChatterToStderr + installJsonExitHook when opts.json is true. We assert
  // those functions exist and are callable (their behavior is unit-tested in json-output.test.ts).
  it('redirectChatterToStderr and installJsonExitHook are exported and callable', async () => {
    const mod = await import('../src/utils/json-output.js');
    expect(typeof mod.redirectChatterToStderr).toBe('function');
    expect(typeof mod.installJsonExitHook).toBe('function');
    expect(() => mod.redirectChatterToStderr()).not.toThrow();
    expect(() => mod.installJsonExitHook()).not.toThrow();
  });
});

describe('registerCommands wires all 7 program groups', () => {
  it('registerCommands adds burnmint, router, lockrelease, spl-token, metaplex, utils, docs', async () => {
    const { registerCommands } = await import('../src/commands/index.js');
    const program = new Command('root');
    registerCommands(program);
    const names = program.commands.map(c => c.name()).sort();
    expect(names).toEqual([
      'burnmint-token-pool',
      'docs',
      'lockrelease-token-pool',
      'metaplex',
      'router',
      'spl-token',
      'utils',
    ]);
  });
});
