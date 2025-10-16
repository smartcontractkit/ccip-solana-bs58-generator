import { setRateLimitAdmin } from '../shared/set-rate-limit-admin.js';
import type { CommandContext, SetRateLimitAdminOptions } from '../../types/command.js';

export async function setRateLimitAdminCommand(
  options: SetRateLimitAdminOptions,
  command: CommandContext
): Promise<void> {
  return setRateLimitAdmin(options, command, 'burnmint-token-pool');
}
