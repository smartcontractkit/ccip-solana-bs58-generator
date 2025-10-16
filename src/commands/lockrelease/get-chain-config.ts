import { getChainConfig } from '../shared/get-chain-config.js';
import type { CommandContext, GetChainConfigOptions } from '../../types/command.js';

export async function getChainConfigCommand(
  options: GetChainConfigOptions,
  command: CommandContext
): Promise<void> {
  return getChainConfig(options, command, 'lockrelease-token-pool');
}
