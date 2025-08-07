import { Command } from 'commander';

/**
 * CCIP Router commands
 */
export function createRouterCommands(): Command {
  const router = new Command('router').description('CCIP Router Program commands').alias('r');

  // Placeholder commands
  router
    .command('update-config')
    .description('Update router configuration')
    .action(() => {
      console.log('🚧 Router commands coming soon...');
      console.log('   Waiting for router IDL');
    });

  router
    .command('add-route')
    .description('Add routing configuration')
    .action(() => {
      console.log('🚧 Router commands coming soon...');
      console.log('   Waiting for router IDL');
    });

  return router;
}
