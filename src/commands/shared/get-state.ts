import { Connection, PublicKey } from '@solana/web3.js';
import { GetStateArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { getProgramConfig, type ProgramName } from '../../types/program-registry.js';
import type { CommandContext, GetStateOptions } from '../../types/command.js';
import { AccountDerivation as BurnmintDerivation } from '../../programs/burnmint-token-pool/accounts.js';
import { AccountDerivation as LockreleaseDerivation } from '../../programs/lockrelease-token-pool/accounts.js';

/**
 * Shared get state implementation for reading on-chain state accounts
 */
export async function getState(
  options: GetStateOptions,
  command: CommandContext,
  programType: ProgramName
): Promise<void> {
  const cmdLogger = createChildLogger(logger, { command: `${programType}.get-state` });

  try {
    // Get global options and program config
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};
    const programConfig = getProgramConfig(programType);

    if (!programConfig?.idl) {
      console.error(`❌ ${programConfig.displayName} IDL not available`);
      process.exit(1);
    }

    // Validate arguments
    const parsed = validateArgs(GetStateArgsSchema, {
      programId: options.programId,
      mint: options.mint,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    });

    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      console.error('💡 Expected format:');
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • RPC URL: Valid HTTP/HTTPS URL');
      process.exit(1);
    }

    const { programId, mint, rpcUrl } = parsed.data;

    // Derive state PDA based on program type
    let statePda: PublicKey;
    if (programType === 'burnmint-token-pool') {
      [statePda] = BurnmintDerivation.deriveStatePda(programId, mint);
    } else if (programType === 'lockrelease-token-pool') {
      [statePda] = LockreleaseDerivation.deriveStatePda(programId, mint);
    } else {
      throw new Error(`Unsupported program type: ${programType}`);
    }

    cmdLogger.debug(
      {
        programId: programId.toString(),
        mint: mint.toString(),
        statePda: statePda.toString(),
      },
      'Fetching state account'
    );

    console.log('🔍 Reading token pool state...');
    console.log(`   RPC URL: ${rpcUrl}`);
    console.log(`   Program ID: ${programId.toString()}`);
    console.log(`   Mint: ${mint.toString()}`);
    console.log(`   State PDA: ${statePda.toString()}`);

    // Fetch account data from blockchain
    const connection = new Connection(rpcUrl as string);
    const accountInfo = await connection.getAccountInfo(statePda);

    if (!accountInfo) {
      console.error('❌ State account not found');
      console.error('💡 This pool may not be initialized yet.');
      console.error('💡 Run the initialize-pool instruction first.');
      cmdLogger.error({ statePda: statePda.toString() }, 'State account does not exist');
      process.exit(1);
    }

    cmdLogger.debug(
      {
        accountDataLength: accountInfo.data.length,
        owner: accountInfo.owner.toString(),
      },
      'Account data retrieved'
    );

    console.log('✅ State account found');
    console.log('');

    // Deserialize account data manually
    const stateAccount = deserializeStateAccount(accountInfo.data);

    cmdLogger.debug({ stateAccount }, 'State account deserialized successfully');

    // Display formatted output
    displayStateAccount(stateAccount, programType, programId, statePda);

    cmdLogger.info('getState command completed successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: message }, 'getState failed');

    if (error instanceof Error && error.stack) {
      cmdLogger.error({ stack: error.stack }, 'Stack trace');
    }

    // Provide helpful error messages
    if (message.includes('Non-base58 character')) {
      console.error('❌ Invalid Base58 public key format');
      console.error('💡 Expected format:');
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   Example: 11111111111111111111111111111112');
    } else if (message.includes('Invalid URL')) {
      console.error('❌ Invalid RPC URL');
      console.error('💡 Use --env devnet or --rpc-url "https://api.devnet.solana.com"');
    } else {
      console.error(`❌ ${message}`);
    }
    process.exit(1);
  }
}

/**
 * State account structure from IDL
 */
interface StateAccount {
  version: number;
  config: {
    tokenProgram: PublicKey;
    mint: PublicKey;
    decimals: number;
    poolSigner: PublicKey;
    poolTokenAccount: PublicKey;
    owner: PublicKey;
    proposedOwner: PublicKey;
    rateLimitAdmin: PublicKey;
    routerOnrampAuthority: PublicKey;
    router: PublicKey;
    rebalancer?: PublicKey;
    canAcceptLiquidity?: boolean;
    listEnabled: boolean;
    allowList: PublicKey[];
    rmnRemote: PublicKey;
  };
}

/**
 * Manually deserialize State account data
 * Avoids BorshAccountsCoder issues with incomplete IDL types
 *
 * @param data - Raw account data buffer from the blockchain
 * @returns Deserialized state account object
 */
function deserializeStateAccount(data: Buffer): StateAccount {
  let offset = 8; // Skip 8-byte Anchor discriminator

  // Read version (u8)
  const version = data.readUInt8(offset);
  offset += 1;

  // Read BaseConfig fields
  const tokenProgram = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const mint = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const decimals = data.readUInt8(offset);
  offset += 1;

  const poolSigner = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const poolTokenAccount = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const owner = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const proposedOwner = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const rateLimitAdmin = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const routerOnrampAuthority = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const router = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const rebalancer = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const canAcceptLiquidity = data.readUInt8(offset) === 1;
  offset += 1;

  const listEnabled = data.readUInt8(offset) === 1;
  offset += 1;

  // Read Vec<Pubkey> for allowList
  const allowListLength = data.readUInt32LE(offset);
  offset += 4;

  const allowList: PublicKey[] = [];
  for (let i = 0; i < allowListLength; i++) {
    allowList.push(new PublicKey(data.subarray(offset, offset + 32)));
    offset += 32;
  }

  const rmnRemote = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  return {
    version,
    config: {
      tokenProgram,
      mint,
      decimals,
      poolSigner,
      poolTokenAccount,
      owner,
      proposedOwner,
      rateLimitAdmin,
      routerOnrampAuthority,
      router,
      rebalancer,
      canAcceptLiquidity,
      listEnabled,
      allowList,
      rmnRemote,
    },
  };
}

/**
 * Display state account in a user-friendly format
 */
function displayStateAccount(
  state: StateAccount,
  programType: ProgramName,
  programId: PublicKey,
  statePda: PublicKey
): void {
  const config = state.config;
  const isLockrelease = programType === 'lockrelease-token-pool';

  console.log('📊 Token Pool State Account');
  console.log('');

  // Program Information
  console.log('Program Information:');
  console.log(
    `  Program Type:         ${programType === 'burnmint-token-pool' ? 'Burnmint Token Pool' : 'Lockrelease Token Pool'}`
  );
  console.log(`  Program ID:           ${programId.toString()}`);
  console.log(`  State Account:        ${statePda.toString()}`);
  console.log(`  Version:              ${state.version}`);
  console.log('');

  // Token Configuration
  console.log('Token Configuration:');
  console.log(`  Mint:                 ${config.mint.toString()}`);
  console.log(`  Decimals:             ${config.decimals}`);
  console.log(`  Token Program:        ${config.tokenProgram.toString()}`);
  console.log('');

  // Pool Accounts
  console.log('Pool Accounts:');
  console.log(`  Pool Signer:          ${config.poolSigner.toString()}`);
  console.log(`  Pool Token Account:   ${config.poolTokenAccount.toString()}`);
  console.log('');

  // Governance
  console.log('Governance:');
  console.log(`  Owner:                ${config.owner.toString()}`);
  const proposedOwnerStr =
    config.proposedOwner.toString() === '11111111111111111111111111111111'
      ? 'None'
      : config.proposedOwner.toString();
  console.log(`  Proposed Owner:       ${proposedOwnerStr}`);
  console.log(`  Rate Limit Admin:     ${config.rateLimitAdmin.toString()}`);
  console.log('');

  // Configuration
  console.log('Configuration:');
  console.log(`  Router:               ${config.router.toString()}`);
  console.log(`  Router Onramp Auth:   ${config.routerOnrampAuthority.toString()}`);
  console.log(`  RMN Remote:           ${config.rmnRemote.toString()}`);
  console.log('');

  // Access Control
  console.log('Access Control:');
  console.log(`  Allow List Enabled:   ${config.listEnabled}`);
  console.log(`  Allow List Size:      ${config.allowList.length} address(es)`);

  if (config.allowList.length === 0) {
    console.log('  Allow List:           Empty');
  } else if (config.allowList.length <= 5) {
    console.log('  Allow List:');
    config.allowList.forEach((addr: PublicKey, index: number) => {
      console.log(`    ${index + 1}. ${addr.toString()}`);
    });
  } else {
    console.log('  Allow List:');
    // Show first 3
    for (let i = 0; i < 3; i++) {
      const address = config.allowList[i];
      if (address) {
        console.log(`    ${i + 1}. ${address.toString()}`);
      }
    }
    console.log(`    ... (${config.allowList.length - 5} more addresses)`);
    // Show last 2
    for (let i = config.allowList.length - 2; i < config.allowList.length; i++) {
      const address = config.allowList[i];
      if (address) {
        console.log(`    ${i + 1}. ${address.toString()}`);
      }
    }
  }
  console.log('');

  // Lockrelease-specific fields
  if (isLockrelease && config.rebalancer && config.canAcceptLiquidity !== undefined) {
    console.log('Lockrelease-Specific:');
    console.log(`  Rebalancer:           ${config.rebalancer.toString()}`);
    console.log(`  Can Accept Liquidity: ${config.canAcceptLiquidity}`);
    console.log('');
  }
}
