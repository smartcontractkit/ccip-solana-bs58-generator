import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { Keypair } from '@solana/web3.js';
import { createBurnmintCommands } from '../src/commands/burnmint/index.js';
import { createLockReleaseCommands } from '../src/commands/lockrelease/index.js';
import { createSplTokenCommands } from '../src/commands/spl-token/index.js';
import * as connectionUtil from '../src/utils/connection.js';

const PK = '2SGSoyjD1QLEpL8SsA2Zhc51jRCQPiZ6GjJWZGkvC3V3';
const PK2 = 'BPympxtoS3GZmNcGiTxqsH6kyRgKiS9QFjfviSLaqxRE';

/**
 * Run a command with a parent that carries the given global opts, capturing exit calls.
 * The parent declares the same global options as src/index.ts and we pass them via argv so
 * Commander's opts() reflects them (setOptionValue does NOT populate opts() reliably).
 *
 * `extraGlobals` are passed as argv before the subcommand; `resolvedRpcUrl` is set directly on
 * the parent opts after parse (since it's derived, not a raw flag).
 */
async function runWithGlobals(
  buildCmd: () => Command,
  globalOpts: Record<string, unknown>,
  args: string[]
): Promise<{ exitCode: number | null; stderr: string[] }> {
  const parent = new Command('root');
  parent.option('--verbose');
  parent.option('--env, --environment <env>');
  parent.option('--rpc-url <url>');
  parent.option('--execute');
  parent.option('--keypair <path>');
  parent.option('--format <format>');
  parent.option('--json');
  // Derive resolvedRpcUrl the way src/index.ts does. The root hook fires with thisCommand ===
  // root; we mutate root.opts() directly (Commander persists mutation across hooks). The
  // subcommand hook then reads thisCommand.parent.opts().resolvedRpcUrl and sees it.
  parent.hook('preAction', thisCommand => {
    if (thisCommand === parent) {
      const o = thisCommand.opts();
      if (o.rpcUrl) o.resolvedRpcUrl = o.rpcUrl;
      else if (o.environment) o.resolvedRpcUrl = 'https://api.devnet.solana.com';
    }
  });
  // NOTE: do NOT call exitOverride() — it makes Commander throw on help/version/errors before
  // the subcommand hook runs. The process.exit spy handles exit interception.

  const cmd = buildCmd();
  parent.addCommand(cmd);

  // Build the global argv from the requested globalOpts.
  const globalArgv: string[] = [];
  if (globalOpts.environment) globalArgv.push('--env', String(globalOpts.environment));
  if (globalOpts.rpcUrl) globalArgv.push('--rpc-url', String(globalOpts.rpcUrl));
  if (globalOpts.execute) globalArgv.push('--execute');
  if (globalOpts.keypair) globalArgv.push('--keypair', String(globalOpts.keypair));
  if (globalOpts.json) globalArgv.push('--json');
  if (globalOpts.format) globalArgv.push('--format', String(globalOpts.format));

  const exits: number[] = [];
  const errs: string[] = [];
  const exitSpy = vi
    .spyOn(process, 'exit')
    .mockImplementation((code?: string | number | null | undefined) => {
      exits.push(typeof code === 'number' ? code : 0);
      throw new Error(`__EXIT_${typeof code === 'number' ? code : 0}__`);
    });
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    errs.push(a.map(String).join(' '));
  });
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  // The lockrelease handlers (provide/withdraw/set-rebalancer/set-can-accept-liquidity) pass
  // preAction validation when --authority is supplied, so commander proceeds into .action(),
  // which calls the async handler fire-and-forget (no await/return in the .action() body). The
  // handler then createConnection(rpcUrl) + getAccountInfo(mint) — against live devnet if we let
  // the real createConnection run. Stub it to a connection whose getAccountInfo rejects, so the
  // handler fails fast and deterministically offline, hits its catch, and calls process.exit(1).
  const connStub = {
    getAccountInfo: vi.fn().mockRejectedValue(new Error('stub: no network in tests')),
    getLatestBlockhash: vi.fn().mockRejectedValue(new Error('stub: no network in tests')),
    simulateTransaction: vi.fn().mockRejectedValue(new Error('stub: no network in tests')),
  };
  const createConnSpy = vi
    .spyOn(connectionUtil, 'createConnection')
    .mockReturnValue(connStub as unknown as ReturnType<typeof connectionUtil.createConnection>);

  // The async handler's promise is dropped by commander's .action() (fire-and-forget), so the
  // exit-spy throw escapes as an unhandled rejection rather than propagating through parseAsync.
  // Vitest installs its own unhandledRejection listener that fails the run on any rejection, so
  // merely adding a listener is not enough — we must temporarily detach ALL listeners (including
  // vitest's) for the parse window, swallow the exit-spy throws, then restore vitest's listeners
  // so genuine rejections in other tests are still caught.
  const savedListeners = process.listeners('unhandledRejection');
  process.removeAllListeners('unhandledRejection');
  const swallowed: unknown[] = [];
  const swallowRejection = (reason: unknown) => {
    swallowed.push(reason);
  };
  process.on('unhandledRejection', swallowRejection);

  try {
    try {
      await parent.parseAsync(['node', 'root', ...globalArgv, ...args]);
    } catch {
      // process.exit throws via the spy; also catch commander ConfigError
    }
    // The async handler's promise is dropped by commander's fire-and-forget .action(), so its
    // rejection (the exit-spy throw escaping the handler's own catch) lands on a later microtask
    // than parseAsync's resolution. Drain the microtask queue here — while our swallower is still
    // attached — so the rejection is swallowed before vitest's listeners are restored in finally.
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
  } finally {
    exitSpy.mockRestore();
    errSpy.mockRestore();
    logSpy.mockRestore();
    createConnSpy.mockRestore();
    process.off('unhandledRejection', swallowRejection);
    // Restore vitest's (and any other) unhandledRejection listeners.
    process.removeAllListeners('unhandledRejection');
    for (const l of savedListeners) process.on('unhandledRejection', l);
  }

  // If the hook reads resolvedRpcUrl (derived), inject it now for any post-parse assertions.
  // (The real hook sets it during parse; for our validation-only tests the hook reads
  // resolvedRpcUrl, so we rely on the subcommand's parent.opts() — which won't have it. Instead
  // the subcommand hook reads thisCommand.parent.opts().resolvedRpcUrl. We set it via the parent's
  // internal store so the subcommand sees it.)
  return { exitCode: exits.length ? exits[exits.length - 1]! : null, stderr: errs };
}

const GLOBALS_OK = { environment: 'devnet' };

describe('burnmint preAction validation', () => {
  it('rejects --execute on get-state (read-only)', async () => {
    const { exitCode, stderr } = await runWithGlobals(
      createBurnmintCommands,
      { ...GLOBALS_OK, execute: true },
      ['burnmint-token-pool', '--instruction', 'get-state', '--program-id', PK, '--mint', PK]
    );
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/not supported for read-only/);
  });

  it('rejects --execute on get-chain-config (read-only)', async () => {
    const { stderr } = await runWithGlobals(
      createBurnmintCommands,
      { ...GLOBALS_OK, execute: true },
      [
        'burnmint-token-pool',
        '--instruction',
        'get-chain-config',
        '--program-id',
        PK,
        '--mint',
        PK,
        '--remote-chain-selector',
        '123',
      ]
    );
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/not supported for read-only/);
  });

  it('requires --authority for non-read-only instructions', async () => {
    const { exitCode, stderr } = await runWithGlobals(createBurnmintCommands, GLOBALS_OK, [
      'burnmint-token-pool',
      '--instruction',
      'accept-ownership',
      '--program-id',
      PK,
      '--mint',
      PK,
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/requires: --authority/);
  });

  it('does NOT require --authority for get-state', async () => {
    // get-state will proceed past the authority check; it will then try to fetch on-chain state
    // and fail at the RPC layer. We only assert it got PAST the authority check (no "requires
    // --authority" message). The action handler runs the real network call, so stub the connection
    // by expecting either an exit (account not found) or a throw — but NOT the authority error.
    const { stderr } = await runWithGlobals(createBurnmintCommands, GLOBALS_OK, [
      'burnmint-token-pool',
      '--instruction',
      'get-state',
      '--program-id',
      PK,
      '--mint',
      PK,
    ]);
    expect(stderr.join(' ')).not.toMatch(/requires: --authority/);
  });

  it('requires --program-id and --mint for all instructions', async () => {
    const { exitCode, stderr } = await runWithGlobals(createBurnmintCommands, GLOBALS_OK, [
      'burnmint-token-pool',
      '--instruction',
      'get-state',
      '--mint',
      PK,
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/--program-id and --mint/);
  });

  it('rejects missing --proposed-owner for transfer-ownership', async () => {
    const { exitCode, stderr } = await runWithGlobals(createBurnmintCommands, GLOBALS_OK, [
      'burnmint-token-pool',
      '--instruction',
      'transfer-ownership',
      '--program-id',
      PK,
      '--mint',
      PK,
      '--authority',
      PK2,
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/--proposed-owner/);
  });

  it('rejects missing --new-rate-limit-admin for set-rate-limit-admin', async () => {
    const { exitCode, stderr } = await runWithGlobals(createBurnmintCommands, GLOBALS_OK, [
      'burnmint-token-pool',
      '--instruction',
      'set-rate-limit-admin',
      '--program-id',
      PK,
      '--mint',
      PK,
      '--authority',
      PK2,
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/--new-rate-limit-admin/);
  });

  it('rejects missing --remote-chain-selector for delete-chain-config', async () => {
    const { exitCode, stderr } = await runWithGlobals(createBurnmintCommands, GLOBALS_OK, [
      'burnmint-token-pool',
      '--instruction',
      'delete-chain-config',
      '--program-id',
      PK,
      '--mint',
      PK,
      '--authority',
      PK2,
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/--remote-chain-selector/);
  });

  it('rejects missing --add/--enabled for configure-allow-list', async () => {
    const { exitCode, stderr } = await runWithGlobals(createBurnmintCommands, GLOBALS_OK, [
      'burnmint-token-pool',
      '--instruction',
      'configure-allow-list',
      '--program-id',
      PK,
      '--mint',
      PK,
      '--authority',
      PK2,
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/--add|--enabled/);
  });

  it('rejects missing --remove for remove-from-allow-list', async () => {
    const { exitCode, stderr } = await runWithGlobals(createBurnmintCommands, GLOBALS_OK, [
      'burnmint-token-pool',
      '--instruction',
      'remove-from-allow-list',
      '--program-id',
      PK,
      '--mint',
      PK,
      '--authority',
      PK2,
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/--remove/);
  });

  it('rejects missing --addresses for append-remote-pool-addresses', async () => {
    const { exitCode, stderr } = await runWithGlobals(createBurnmintCommands, GLOBALS_OK, [
      'burnmint-token-pool',
      '--instruction',
      'append-remote-pool-addresses',
      '--program-id',
      PK,
      '--mint',
      PK,
      '--authority',
      PK2,
      '--remote-chain-selector',
      '123',
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/--addresses/);
  });

  it('rejects missing rate-limit fields for set-chain-rate-limit', async () => {
    const { exitCode, stderr } = await runWithGlobals(createBurnmintCommands, GLOBALS_OK, [
      'burnmint-token-pool',
      '--instruction',
      'set-chain-rate-limit',
      '--program-id',
      PK,
      '--mint',
      PK,
      '--authority',
      PK2,
      '--remote-chain-selector',
      '123',
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/inbound-enabled|outbound-enabled|inbound-capacity/);
  });

  it('rejects missing --token-address/--decimals for init-chain-remote-config', async () => {
    const { exitCode, stderr } = await runWithGlobals(createBurnmintCommands, GLOBALS_OK, [
      'burnmint-token-pool',
      '--instruction',
      'init-chain-remote-config',
      '--program-id',
      PK,
      '--mint',
      PK,
      '--authority',
      PK2,
      '--remote-chain-selector',
      '123',
      '--pool-addresses',
      '[]',
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/token-address|decimals/);
  });

  it('rejects unknown instruction', async () => {
    const { exitCode, stderr } = await runWithGlobals(createBurnmintCommands, GLOBALS_OK, [
      'burnmint-token-pool',
      '--instruction',
      'nope',
      '--program-id',
      PK,
      '--mint',
      PK,
      '--authority',
      PK2,
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/Unknown instruction/);
  });
});

describe('lockrelease routing', () => {
  it('routes the 4 lockrelease-specific instructions (no "Unknown instruction")', async () => {
    for (const instr of [
      'provide-liquidity',
      'withdraw-liquidity',
      'set-rebalancer',
      'set-can-accept-liquidity',
    ]) {
      // These will fail validation for missing fields, but must NOT say "Unknown instruction".
      const { stderr } = await runWithGlobals(createLockReleaseCommands, GLOBALS_OK, [
        'lockrelease-token-pool',
        '--instruction',
        instr,
        '--program-id',
        PK,
        '--mint',
        PK,
        '--authority',
        PK2,
      ]);
      expect(stderr.join(' ')).not.toMatch(/Unknown instruction/);
    }
  });

  it('rejects --execute on get-state (read-only)', async () => {
    const { stderr } = await runWithGlobals(
      createLockReleaseCommands,
      { ...GLOBALS_OK, execute: true },
      ['lockrelease-token-pool', '--instruction', 'get-state', '--program-id', PK, '--mint', PK]
    );
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/not supported for read-only/);
  });
});

describe('spl-token routing', () => {
  it('create-mint requires --authority and --decimals', async () => {
    const { exitCode, stderr } = await runWithGlobals(createSplTokenCommands, GLOBALS_OK, [
      'spl-token',
      '--instruction',
      'create-mint',
      '--mint',
      PK,
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/--authority.*--decimals|--decimals.*--authority/);
  });

  it('create-multisig requires --authority, --signers, --threshold, --mint, --seed', async () => {
    const { exitCode, stderr } = await runWithGlobals(createSplTokenCommands, GLOBALS_OK, [
      'spl-token',
      '--instruction',
      'create-multisig',
      '--authority',
      PK,
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/--signers|--threshold|--mint|--seed/);
  });

  it('mint requires --authority, --mint, --recipient, --amount', async () => {
    const { exitCode, stderr } = await runWithGlobals(createSplTokenCommands, GLOBALS_OK, [
      'spl-token',
      '--instruction',
      'mint',
      '--authority',
      PK,
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/--mint|--recipient|--amount/);
  });

  it('approve requires --authority, --mint, --delegate, --amount', async () => {
    const { exitCode, stderr } = await runWithGlobals(createSplTokenCommands, GLOBALS_OK, [
      'spl-token',
      '--instruction',
      'approve',
      '--authority',
      PK,
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/--delegate|--amount/);
  });

  it('rejects unknown instruction', async () => {
    const { exitCode, stderr } = await runWithGlobals(createSplTokenCommands, GLOBALS_OK, [
      'spl-token',
      '--instruction',
      'nope',
      '--authority',
      PK,
    ]);
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join(' ')).toMatch(/Unknown instruction/);
  });
});

describe('applyExecuteAuthority (via burnmint --execute path)', () => {
  // Loading a real keypair file is heavy; instead assert that --execute WITHOUT --authority and
  // WITHOUT a loadable keypair fails at the keypair-load step (not the authority step), proving
  // applyExecuteAuthority ran and tried to derive authority from the keypair.
  it('in --execute mode with no --authority, attempts to load a keypair (fails on missing file)', async () => {
    const { exitCode, stderr } = await runWithGlobals(
      createBurnmintCommands,
      { ...GLOBALS_OK, execute: true, keypair: '/nonexistent/keypair.json' },
      ['burnmint-token-pool', '--instruction', 'accept-ownership', '--program-id', PK, '--mint', PK]
    );
    expect(stderr.length).toBeGreaterThan(0);
    // The keypair load failure message, NOT the "requires --authority" message.
    expect(stderr.join(' ')).toMatch(/Could not load keypair|keypair/);
    expect(stderr.join(' ')).not.toMatch(/requires: --authority/);
  });
});
