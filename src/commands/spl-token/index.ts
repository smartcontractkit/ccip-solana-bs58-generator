import { Command } from 'commander';

/**
 * SPL Token Program commands
 */
export function createSplTokenCommands(): Command {
  const splToken = new Command('spl-token').description('SPL Token Program commands').alias('spl');

  // Placeholder commands
  splToken
    .command('mint')
    .description('Mint tokens to an account')
    .action(() => {
      console.log('🚧 SPL Token commands coming soon...');
      console.log('   Manual instruction building for well-known SPL Token operations');
    });

  splToken
    .command('transfer-mint-authority')
    .description('Transfer mint authority to another account')
    .action(() => {
      console.log('🚧 SPL Token commands coming soon...');
      console.log('   Manual instruction building for well-known SPL Token operations');
    });

  splToken
    .command('approve')
    .description('Approve tokens for spending')
    .action(() => {
      console.log('🚧 SPL Token commands coming soon...');
    });

  return splToken;
}
