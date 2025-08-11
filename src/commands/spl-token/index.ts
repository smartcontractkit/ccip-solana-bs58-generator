import { Command } from 'commander';
import { createSplMultisigCommand } from './multisig-create.js';
import { mintCommand } from './mint.js';
import { transferMintAuthorityCommand } from './transfer-mint-authority.js';
import { updateMetadataAuthorityCommand } from './update-metadata-authority.js';

export function createSplTokenCommands(): Command {
  const splToken = new Command('spl-token')
    .description('SPL Token Program commands')
    .alias('spl')
    .requiredOption(
      '--instruction <instruction>',
      'Instruction to execute (create-multisig, mint, transfer-mint-authority, update-metadata-authority)'
    )
    .option('--authority <authority>', 'Payer/authority public key')
    .option(
      '--mint <pubkey>',
      'Token mint address (required for mint; also used to detect token program for create-multisig)'
    )
    .option('--recipient <pubkey>', 'Recipient owner address (for mint)')
    .option('--amount <u64>', 'Amount in smallest unit (for mint)')
    .option('--multisig <pubkey>', 'SPL multisig address (optional, for mint)')
    .option('--multisig-signers <json>', 'JSON array of signer pubkeys (optional, for mint)')
    .option('--signers <json>', 'JSON array of signer pubkeys (for create-multisig)')
    .option('--threshold <m>', 'Threshold (for create-multisig)')
    .option('--seed <string>', 'Seed for createAccountWithSeed (required for create-multisig)')
    .option('--new-mint-authority <pubkey>', 'New mint authority (for transfer-mint-authority)')

    .option(
      '--metadata-account <pubkey>',
      'Explicit metadata account (Token-2022), defaults to mint'
    )
    .hook('preAction', thisCommand => {
      const globalOpts = thisCommand.parent?.opts() || {};
      if (!globalOpts.resolvedRpcUrl) {
        console.error('❌ Either --env or --rpc-url is required for transaction commands');
        console.error('💡 Use --env devnet or --rpc-url "https://custom-endpoint.com"');
        process.exit(1);
      }
      const options = thisCommand.opts();
      const instr = options.instruction as string;
      if (instr === 'create-multisig') {
        if (!options.authority || !options.signers || !options.threshold) {
          console.error('❌ create-multisig requires: --authority, --signers <json>, --threshold');
          process.exit(1);
        }
        if (!options.mint) {
          console.error('❌ create-multisig requires: --mint to detect the correct token program');
          process.exit(1);
        }
        if (!options.seed) {
          console.error('❌ create-multisig requires: --seed <string>');
          process.exit(1);
        }
      } else if (instr === 'mint') {
        if (!options.authority || !options.mint || !options.recipient || !options.amount) {
          console.error('❌ mint requires: --authority, --mint, --recipient, --amount');
          process.exit(1);
        }
        if (
          (options.multisig && !options.multisigSigners) ||
          (!options.multisig && options.multisigSigners)
        ) {
          console.error('❌ When using --multisig, also provide --multisig-signers <json>');
          process.exit(1);
        }
        if (options.multisig && options.multisigSigners) {
          try {
            const arr = JSON.parse(options.multisigSigners as string);
            if (!Array.isArray(arr) || arr.length === 0) {
              console.error(
                '❌ --multisig-signers must be a non-empty JSON array when --multisig is used'
              );
              process.exit(1);
            }
          } catch {
            console.error('❌ Invalid JSON for --multisig-signers');
            process.exit(1);
          }
        }
      } else if (instr === 'transfer-mint-authority') {
        if (!options.authority || !options.mint || !options.newMintAuthority) {
          console.error(
            '❌ transfer-mint-authority requires: --authority, --mint, --new-mint-authority'
          );
          process.exit(1);
        }
        if (
          (options.multisig && !options.multisigSigners) ||
          (!options.multisig && options.multisigSigners)
        ) {
          console.error('❌ When using --multisig, also provide --multisig-signers <json>');
          process.exit(1);
        }
        if (options.multisig && options.multisigSigners) {
          try {
            const arr = JSON.parse(options.multisigSigners as string);
            if (!Array.isArray(arr) || arr.length === 0) {
              console.error(
                '❌ --multisig-signers must be a non-empty JSON array when --multisig is used'
              );
              process.exit(1);
            }
          } catch {
            console.error('❌ Invalid JSON for --multisig-signers');
            process.exit(1);
          }
        }
      } else if (instr === 'update-metadata-authority') {
        if (!options.authority || !options.mint) {
          console.error('❌ update-metadata-authority requires: --authority, --mint');
          process.exit(1);
        }
      } else {
        console.error(`❌ Unknown instruction: ${instr}`);
        process.exit(1);
      }
    })
    .action((options, command) => {
      const i = options.instruction as string;
      if (i === 'create-multisig') {
        createSplMultisigCommand(options, command);
      } else if (i === 'mint') {
        mintCommand(options, command);
      } else if (i === 'transfer-mint-authority') {
        transferMintAuthorityCommand(options, command);
      } else if (i === 'update-metadata-authority') {
        updateMetadataAuthorityCommand(options, command);
      }
    });

  return splToken;
}
