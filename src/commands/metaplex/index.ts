import { Command } from 'commander';
import { updateMetadataAuthorityCommand } from './update-authority.js';

export function createMetaplexCommands(): Command {
  const metaplex = new Command('metaplex')
    .description('Metaplex Token Metadata commands')
    .alias('mpl')
    .requiredOption('--instruction <instruction>', 'Instruction to execute (update-authority)')
    .option('--authority <authority>', 'Current update authority public key')
    .option('--mint <pubkey>', 'Token mint address')
    .option('--new-authority <pubkey>', 'New update authority public key')
    .hook('preAction', thisCommand => {
      const globalOpts = thisCommand.parent?.opts() || {};
      if (!globalOpts.resolvedRpcUrl) {
        console.error('❌ Either --env or --rpc-url is required for transaction commands');
        console.error('💡 Use --env devnet or --rpc-url "https://custom-endpoint.com"');
        process.exit(1);
      }
      const options = thisCommand.opts();
      const instr = options.instruction as string;
      if (instr === 'update-authority') {
        if (!options.authority || !options.mint || !options.newAuthority) {
          console.error('❌ update-authority requires: --authority, --mint, --new-authority');
          process.exit(1);
        }
      } else {
        console.error(`❌ Unknown instruction: ${instr}`);
        process.exit(1);
      }
    })
    .action((options, command) => {
      const i = options.instruction as string;
      if (i === 'update-authority') {
        updateMetadataAuthorityCommand(options, command);
      }
    });

  return metaplex;
}
