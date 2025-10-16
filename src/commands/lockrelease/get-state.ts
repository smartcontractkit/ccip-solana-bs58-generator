import { getState } from '../shared/get-state.js';
import type { CommandContext, GetStateOptions } from '../../types/command.js';

export async function getStateCommand(
  options: GetStateOptions,
  command: CommandContext
): Promise<void> {
  return getState(options, command, 'lockrelease-token-pool');
}
