import type { CommandContext, AppendRemotePoolAddressesOptions } from '../../types/command.js';
import { appendRemotePoolAddresses } from '../shared/append-remote-pool-addresses.js';

/**
 * Append remote pool addresses command for lockrelease token pool
 */
export async function appendRemotePoolAddressesCommand(
  options: AppendRemotePoolAddressesOptions,
  command: CommandContext
): Promise<void> {
  return appendRemotePoolAddresses(options, command, 'lockrelease-token-pool');
}
