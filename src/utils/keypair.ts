import type { Command } from 'commander';
import { Keypair } from '@solana/web3.js';
import { loadKeypair } from './transaction-executor.js';
import { DEFAULT_KEYPAIR_PATH } from './constants.js';
import type { GlobalCommandOptions } from '../types/command.js';

/**
 * Expand a leading `~/` to the user's home directory.
 */
export function expandHomePath(path: string): string {
  if (path.startsWith('~/')) {
    return `${process.env.HOME || process.env.USERPROFILE || ''}/${path.slice(2)}`;
  }
  return path;
}

/**
 * Resolve the keypair path to load for --execute mode.
 * Uses --keypair when provided, otherwise the default Solana CLI keypair.
 */
export function resolveKeypairPath(globalOpts: GlobalCommandOptions): string {
  return expandHomePath(globalOpts.keypair ?? DEFAULT_KEYPAIR_PATH);
}

/**
 * Load the signer keypair for --execute mode, caching it on the global options
 * object so it is only read from disk once per invocation. Prints a friendly
 * message and exits if the file cannot be loaded.
 */
export function loadSignerKeypair(globalOpts: GlobalCommandOptions): Keypair {
  if (globalOpts._signerKeypair) {
    return globalOpts._signerKeypair;
  }

  const keypairPath = resolveKeypairPath(globalOpts);
  try {
    const keypair = loadKeypair(keypairPath);
    globalOpts._signerKeypair = keypair;
    return keypair;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Could not load keypair: ${message}`);
    console.error(
      '💡 Pass --keypair <path>, or run `solana-keygen new` to create the default one.'
    );
    process.exit(1);
  }
}

/**
 * In --execute mode, auto-derive --authority from the signer keypair so the user
 * does not have to retype their own public key.
 *
 * - No-op when --execute is not set (encode/Squads mode keeps --authority required).
 * - When --authority is omitted, sets it to the keypair's public key.
 * - When --authority is provided, enforces that it matches the keypair.
 *
 * Sets the value on both the live `options` object (so the hook's own validation
 * sees it) and via `setOptionValue` (so the action handler sees it).
 */
export function applyExecuteAuthority(
  thisCommand: Command,
  options: Record<string, unknown>,
  globalOpts: GlobalCommandOptions
): void {
  if (!globalOpts.execute) {
    return;
  }

  const signer = loadSignerKeypair(globalOpts).publicKey.toBase58();
  const provided = options.authority as string | undefined;

  if (!provided) {
    options.authority = signer;
    thisCommand.setOptionValue('authority', signer);
    console.log(`🔑 Authority derived from keypair: ${signer}`);
    return;
  }

  if (provided !== signer) {
    console.error(`❌ --authority ${provided} does not match keypair ${signer}`);
    console.error(
      '💡 In --execute mode, omit --authority (it defaults to your keypair) or pass a matching one.'
    );
    process.exit(1);
  }
}
