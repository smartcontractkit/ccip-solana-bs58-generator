import type { CommandContext, SetChainRateLimitOptions } from '../../types/command.js';
import { setChainRateLimit } from '../shared/set-chain-rate-limit.js';

/**
 * Set chain rate limit command for burnmint token pool
 */
export async function setChainRateLimitCommand(
  options: SetChainRateLimitOptions,
  command: CommandContext
): Promise<void> {
  return setChainRateLimit(options, command, 'burnmint-token-pool');
}
