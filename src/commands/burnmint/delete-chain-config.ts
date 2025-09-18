import type { CommandContext, DeleteChainConfigOptions } from '../../types/command.js';
import { deleteChainConfig } from '../shared/delete-chain-config.js';

/**
 * Delete chain config command for burnmint token pool
 */
export async function deleteChainConfigCommand(
  options: DeleteChainConfigOptions,
  command: CommandContext
): Promise<void> {
  return deleteChainConfig(options, command, 'burnmint-token-pool');
}
