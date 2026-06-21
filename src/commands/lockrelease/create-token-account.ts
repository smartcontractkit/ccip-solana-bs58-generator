import { createTokenAccount } from '../shared/create-token-account.js';
import type { CommandContext, CreateTokenAccountOptions } from '../../types/command.js';

export async function createTokenAccountCommand(
  options: CreateTokenAccountOptions,
  command: CommandContext
): Promise<void> {
  return createTokenAccount(options, command, 'lockrelease-token-pool');
}
