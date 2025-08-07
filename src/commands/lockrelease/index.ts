import { Command } from 'commander';

/**
 * Lock/Release Token Pool commands
 */
export function createLockReleaseCommands(): Command {
  const lockrelease = new Command('lockrelease')
    .description('Lock/Release Token Pool Program commands')
    .alias('lr');

  // Placeholder commands
  lockrelease
    .command('release-tokens')
    .description('Release tokens from lock/release pool')
    .action(() => {
      console.log('🚧 Lock/Release commands coming soon...');
      console.log('   Waiting for lockrelease_token_pool IDL');
    });

  lockrelease
    .command('lock-tokens')
    .description('Lock tokens in lock/release pool')
    .action(() => {
      console.log('🚧 Lock/Release commands coming soon...');
      console.log('   Waiting for lockrelease_token_pool IDL');
    });

  return lockrelease;
}
