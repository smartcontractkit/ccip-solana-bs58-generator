import { removeFromAllowList } from '../shared/remove-from-allow-list.js';
import type { CommandContext, RemoveFromAllowListOptions } from '../../types/command.js';

export async function removeFromAllowListCommand(
  options: RemoveFromAllowListOptions,
  command: CommandContext
): Promise<void> {
  return removeFromAllowList(options, command, 'lockrelease-token-pool');
}
