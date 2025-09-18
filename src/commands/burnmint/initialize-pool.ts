import { initializePool } from '../shared/initialize-pool.js';
import type { CommandContext, InitializePoolOptions } from '../../types/command.js';

export async function initializePoolCommand(
  options: InitializePoolOptions,
  command: CommandContext
): Promise<void> {
  return initializePool(options, command, 'burnmint-token-pool');
}
