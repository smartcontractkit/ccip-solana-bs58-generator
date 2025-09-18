import type { CommandContext, SetChainRateLimitOptions } from '../../types/command.js';
import { setChainRateLimit } from '../shared/set-chain-rate-limit.js';

/**
 * Set chain rate limit command for lockrelease token pool
 */
export async function setChainRateLimitCommand(
  options: SetChainRateLimitOptions,
  command: CommandContext
): Promise<void> {
  return setChainRateLimit(options, command, 'lockrelease-token-pool');
}
