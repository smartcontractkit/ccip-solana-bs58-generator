import { Command } from 'commander';
import { ownerProposeAdministratorCommand } from './owner-propose-administrator.js';
import { ownerOverridePendingAdministratorCommand } from './owner-override-pending-administrator.js';
import { acceptAdminRoleCommand } from './accept-admin-role.js';
import { transferAdminRoleCommand } from './transfer-admin-role.js';
import { setPoolCommand } from './set-pool.js';
import { createLookupTableCommand } from './create-lookup-table.js';
import { appendToLookupTableCommand } from './append-to-lookup-table.js';
import { applyExecuteAuthority } from '../../utils/keypair.js';

/**
 * CCIP Router commands
 */
export function createRouterCommands(): Command {
  const router = new Command('router')
    .description('CCIP Router Program commands')
    .alias('r')
    .requiredOption(
      '--instruction <instruction>',
      'Instruction to execute (owner-propose-administrator, owner-override-pending-administrator, accept-admin-role, transfer-admin-role, set-pool, create-lookup-table, append-to-lookup-table)'
    )
    .option('--program-id <programId>', 'Router program ID (required for most instructions)')
    .option(
      '--mint <mint>',
      'Token mint address (required for registry instructions, optional for append-to-lookup-table)'
    )
    .option('--authority <authority>', 'Authority public key (required for all instructions)')
    .option(
      '--fee-quoter-program-id <pubkey>',
      'Fee Quoter program ID (required for create-lookup-table, optional for append-to-lookup-table)'
    )
    .option(
      '--pool-program-id <pubkey>',
      'Pool program ID (required for create-lookup-table, optional for append-to-lookup-table)'
    )
    .option(
      '--additional-addresses <json>',
      'JSON array of Base58 pubkeys to append (optional for create-lookup-table and append-to-lookup-table)'
    )
    .option(
      '--lookup-table-address <pubkey>',
      'Existing ALT address (required for append-to-lookup-table)'
    )
    // owner/ccip-admin propose/override use the same param name
    .option(
      '--token-admin-registry-admin <pubkey>',
      'Token Admin Registry administrator to propose/override (required for owner-propose-administrator, owner-override-pending-administrator)'
    )
    .option('--new-admin <pubkey>', 'New admin (required for transfer-admin-role)')
    .option('--pool-lookup-table <pubkey>', 'Pool Address Lookup Table (required for set-pool)')
    .option(
      '--writable-indexes <hex>',
      'Writable indexes bitmap as hex string, e.g., 0x80... (required for set-pool)'
    )
    .hook('preAction', thisCommand => {
      const globalOpts = thisCommand.parent?.opts() || {};
      if (!globalOpts.resolvedRpcUrl) {
        console.error('❌ Either --env or --rpc-url is required for transaction commands');
        console.error('💡 Use --env devnet or --rpc-url "https://custom-endpoint.com"');
        process.exit(1);
      }

      const options = thisCommand.opts();
      applyExecuteAuthority(thisCommand, options, globalOpts);

      // common - append-to-lookup-table doesn't need program-id
      const instr = options.instruction as string;
      if (instr !== 'append-to-lookup-table' && (!options.programId || !options.authority)) {
        console.error('❌ All instructions require: --program-id and --authority');
        process.exit(1);
      } else if (instr === 'append-to-lookup-table' && !options.authority) {
        console.error('❌ append-to-lookup-table requires: --authority');
        process.exit(1);
      }
      if (
        instr === 'owner-propose-administrator' ||
        instr === 'owner-override-pending-administrator'
      ) {
        if (!options.mint || !options.tokenAdminRegistryAdmin) {
          console.error(
            '❌ owner-propose-administrator/owner-override-pending-administrator require: --mint and --token-admin-registry-admin'
          );
          process.exit(1);
        }
      } else if (instr === 'accept-admin-role') {
        if (!options.mint) {
          console.error('❌ accept-admin-role requires: --mint');
          process.exit(1);
        }
      } else if (instr === 'transfer-admin-role') {
        if (!options.mint || !options.newAdmin) {
          console.error('❌ transfer-admin-role requires: --mint and --new-admin');
          process.exit(1);
        }
      } else if (instr === 'set-pool') {
        if (!options.mint || !options.poolLookupTable || !options.writableIndexes) {
          console.error(
            '❌ set-pool requires: --mint, --pool-lookup-table, and --writable-indexes'
          );
          process.exit(1);
        }
      } else if (instr === 'create-lookup-table') {
        if (!options.mint || !options.poolProgramId || !options.feeQuoterProgramId) {
          console.error(
            '❌ create-lookup-table requires: --mint, --pool-program-id, and --fee-quoter-program-id'
          );
          process.exit(1);
        }
      } else if (instr === 'append-to-lookup-table') {
        if (!options.lookupTableAddress) {
          console.error('❌ append-to-lookup-table requires: --lookup-table-address');
          console.error(
            '💡 Additionally provide either:\n' +
              '   • CCIP parameters: --program-id, --fee-quoter-program-id, --pool-program-id, --mint\n' +
              '   • Manual addresses: --additional-addresses \'["addr1", "addr2"]\'\n' +
              '   • Both (CCIP + manual addresses)'
          );
          process.exit(1);
        }
      } else {
        console.error(`❌ Unknown instruction: ${instr}`);
        process.exit(1);
      }
    })
    .action((options, command) => {
      const i = options.instruction as string;
      if (i === 'owner-propose-administrator') {
        ownerProposeAdministratorCommand(options, command);
      } else if (i === 'owner-override-pending-administrator') {
        ownerOverridePendingAdministratorCommand(options, command);
      } else if (i === 'accept-admin-role') {
        acceptAdminRoleCommand(options, command);
      } else if (i === 'transfer-admin-role') {
        transferAdminRoleCommand(options, command);
      } else if (i === 'set-pool') {
        setPoolCommand(options, command);
      } else if (i === 'create-lookup-table') {
        createLookupTableCommand(options, command);
      } else if (i === 'append-to-lookup-table') {
        appendToLookupTableCommand(options, command);
      }
    });

  return router;
}
