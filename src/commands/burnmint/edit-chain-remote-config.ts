import type { CommandContext, EditChainRemoteConfigOptions } from '../../types/command.js';
import { editChainRemoteConfig } from '../shared/edit-chain-remote-config.js';

/**
 * Edit chain remote config command for burnmint token pool
 */
export async function editChainRemoteConfigCommand(
  options: EditChainRemoteConfigOptions,
  command: CommandContext
): Promise<void> {
  return editChainRemoteConfig(options, command, 'burnmint-token-pool');
}
