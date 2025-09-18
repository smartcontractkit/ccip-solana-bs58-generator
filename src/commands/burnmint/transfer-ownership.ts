import { transferOwnership } from '../shared/transfer-ownership.js';
import type { CommandContext, TransferOwnershipOptions } from '../../types/command.js';

export async function transferOwnershipCommand(
  options: TransferOwnershipOptions,
  command: CommandContext
): Promise<void> {
  return transferOwnership(options, command, 'burnmint-token-pool');
}
