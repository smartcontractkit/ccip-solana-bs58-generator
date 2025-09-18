import { acceptOwnership } from '../shared/accept-ownership.js';
import type { CommandContext, AcceptOwnershipOptions } from '../../types/command.js';

export async function acceptOwnershipCommand(
  options: AcceptOwnershipOptions,
  command: CommandContext
): Promise<void> {
  return acceptOwnership(options, command, 'burnmint-token-pool');
}
