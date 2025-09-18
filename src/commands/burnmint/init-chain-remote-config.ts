import type { CommandContext, InitChainRemoteConfigOptions } from '../../types/command.js';
import { initChainRemoteConfig } from '../shared/init-chain-remote-config.js';

/**
 * Initialize chain remote config command for burnmint token pool
 */
export async function initChainRemoteConfigCommand(
  options: InitChainRemoteConfigOptions,
  command: CommandContext
): Promise<void> {
  return initChainRemoteConfig(options, command, 'burnmint-token-pool');
}
