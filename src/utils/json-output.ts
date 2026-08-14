/**
 * `--json` output: one machine-readable object on stdout, everything else on stderr.
 *
 * The human output is a log stream with the transaction blob loose in the middle of it. Fine to
 * read in a terminal, useless to a Makefile, a CI step or an agent storing the result.
 *
 * See `redirectChatterToStderr` for how stdout is kept clear of everything but the document.
 */

import type { CommandContext, GlobalCommandOptions } from '../types/command.js';
import type { GeneratedTransaction } from '../types/index.js';
import { PACKAGE_VERSION } from './package-info.js';

/** Commander nests subcommands, so global options live one or two levels up. */
export function getGlobalOptions(command: CommandContext): GlobalCommandOptions {
  return command.parent?.parent?.opts() || command.parent?.opts() || {};
}

export function isJsonMode(command: CommandContext): boolean {
  return getGlobalOptions(command).json === true;
}

let jsonWritten = false;
let lastErrorLine: string | null = null;

/** Write the one document this process is allowed to put on stdout. */
export function emitJson(payload: unknown): void {
  jsonWritten = true;
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

/**
 * Failure envelope, so a caller can tell "the command failed" from "the command produced nothing"
 * without parsing prose. Mirrors the shape already used by scripts/create-alt.ts.
 */
export function emitJsonError(error: unknown, context?: Record<string, unknown>): void {
  emitJson({
    ok: false,
    cliVersion: PACKAGE_VERSION,
    error: error instanceof Error ? error.message : String(error),
    ...(context ?? {}),
  });
}

/** Fields every envelope carries, so a stored artifact records what produced it. */
function envelopeBase(globalOptions: GlobalCommandOptions): Record<string, unknown> {
  return {
    ok: true,
    cliVersion: PACKAGE_VERSION,
    network: {
      env: globalOptions.environment ?? null,
      rpcUrl: globalOptions.resolvedRpcUrl ?? null,
    },
  };
}

export interface ExecutionResult {
  signature: string;
  signer: string;
  explorerUrl: string | null;
}

/**
 * The artifact a caller stores: the encoded transaction plus enough context to know what it is,
 * whether it simulated, and - in `--execute` mode - what happened when it was sent.
 *
 * `transaction` holds the blob in the requested `--format`; `encodings` carries every form, so a
 * registry that later wants base64 does not have to rebuild the transaction to get it.
 */
export function transactionEnvelope(opts: {
  tx: GeneratedTransaction;
  instructionName: string;
  format: string;
  globalOptions: GlobalCommandOptions;
  execution?: ExecutionResult | null;
}): Record<string, unknown> {
  const { tx, instructionName, format, globalOptions, execution } = opts;
  return {
    ...envelopeBase(globalOptions),
    kind: 'transaction',
    instruction: instructionName,
    generatedAt: tx.metadata.generatedAt,
    encoding: format,
    transaction: format === 'base64' ? tx.base64 : tx.base58,
    encodings: { base58: tx.base58, base64: tx.base64, hex: tx.hex },
    accounts: tx.accounts,
    details: tx.details,
    simulation: {
      success: tx.metadata.simulationSuccess ?? null,
      computeUnits: tx.metadata.computeUnits ?? null,
      error: tx.metadata.simulationError ?? null,
    },
    execution: execution
      ? { executed: true, ...execution }
      : { executed: false, signature: null, signer: null, explorerUrl: null },
  };
}

/**
 * Make a deserialized account safe to stringify.
 *
 * Account structs hold `PublicKey`, `BN` and `bigint` values. `JSON.stringify` turns the first two
 * into shapes nobody can consume (`{"_bn":"..."}`) and throws outright on the third, so convert
 * them to the strings a caller expects: base58 for keys, decimal for numbers.
 */
export function toJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return value.toString('base64');
  // PublicKey and BN both answer toBase58/toString; PublicKey is the one worth naming.
  const maybeKey = value as { toBase58?: () => string; toString: () => string };
  if (typeof maybeKey.toBase58 === 'function') return maybeKey.toBase58();
  if (value.constructor?.name === 'BN') return maybeKey.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = toJsonSafe(v);
  return out;
}

/** The all-zero key the pool and registry accounts use to mean "unset". */
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';

/**
 * Report an unset optional key as null.
 *
 * On chain "no proposed owner" is the all-zero key. A caller should not have to know that, least of
 * all for `pool-state` alone while `token-inspection` already says null for the same idea. One
 * spelling of absent across every envelope.
 */
export function keyOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s =
    typeof value === 'string' ? value : String((value as { toString(): string }).toString());
  return s === SYSTEM_PROGRAM_ID ? null : s;
}

/** On-chain state read back by a `get-*`/`inspect-*` command. */
export function stateEnvelope(opts: {
  kind: string;
  globalOptions: GlobalCommandOptions;
  data: Record<string, unknown>;
}): Record<string, unknown> {
  return { ...envelopeBase(opts.globalOptions), kind: opts.kind, ...opts.data };
}

/**
 * Send decorative output to stderr for the rest of the process.
 *
 * There are 400-odd `console.log` calls across the command handlers - banners, progress lines,
 * copy-paste hints. Teaching each one to respect a flag is a far larger change than the feature
 * deserves, and leaves stdout one forgotten call away from being unparseable again. Redirecting
 * once at startup makes it clean by construction: the only writer left is `emitJson`, which uses
 * `process.stdout` directly.
 */
export function redirectChatterToStderr(): void {
  const stderr = console.error.bind(console);
  console.log = stderr;
  console.info = stderr;
  // Remember the last thing that looked like an error so the exit hook below has something better
  // to report than "command failed".
  console.error = (...args: unknown[]): void => {
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (first.startsWith('❌')) lastErrorLine = first.replace(/^❌\s*/, '');
    stderr(...args);
  };
}

/**
 * Guarantee that `--json` always leaves one document on stdout, including when the command fails.
 *
 * Handlers report failures by printing and calling `process.exit(1)` from a dozen different places,
 * so there is no single throw to catch. Hooking `exit` covers all of them: if the process is ending
 * badly and nothing has been written yet, write the failure envelope described on `emitJsonError`.
 */
export function installJsonExitHook(): void {
  process.on('exit', code => {
    if (code === 0 || jsonWritten) return;
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: false,
          cliVersion: PACKAGE_VERSION,
          error: lastErrorLine ?? 'command failed; see stderr for details',
          exitCode: code,
        },
        null,
        2
      )}\n`
    );
  });
}
