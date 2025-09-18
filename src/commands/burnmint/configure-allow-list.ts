import { configureAllowList } from '../shared/configure-allow-list.js';
import type { CommandContext, ConfigureAllowListOptions } from '../../types/command.js';

export async function configureAllowListCommand(
  options: ConfigureAllowListOptions,
  command: CommandContext
): Promise<void> {
  return configureAllowList(options, command, 'burnmint-token-pool');
}
