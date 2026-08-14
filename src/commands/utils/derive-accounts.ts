import { PublicKey, Connection } from '@solana/web3.js';
import { createConnection } from './../../utils/connection.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { logger, createChildLogger } from '../../utils/logger.js';
import { emitJson, stateEnvelope, toJsonSafe } from '../../utils/json-output.js';
import { validateArgs } from '../../utils/validation.js';
import { AccountDerivation as BurnmintDerivation } from '../../programs/burnmint-token-pool/accounts.js';
import { AccountDerivation as LockreleaseDerivation } from '../../programs/lockrelease-token-pool/accounts.js';
import { AccountDerivation as RouterDerivation } from '../../programs/router/accounts.js';
import { detectTokenProgramId } from '../../utils/token.js';
import {
  BURNMINT_TOKEN_POOL,
  LOCKRELEASE_TOKEN_POOL,
  ROUTER_SEEDS,
} from '../../utils/constants.js';
import { z } from 'zod';

// Validation schema for derive-accounts command
const DeriveAccountsArgsSchema = z.object({
  programType: z.enum(['burnmint-token-pool', 'lockrelease-token-pool', 'router', 'spl-token']),
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  poolProgramId: z
    .string()
    .optional()
    .transform(val => (val ? new PublicKey(val) : undefined)),
  remoteChainSelector: z
    .string()
    .optional()
    .transform(val => (val ? BigInt(val) : undefined)),
  rpcUrl: z.string(),
});

interface DerivedAccount {
  name: string;
  address: string;
  seeds: string;
  bump?: number;
  description: string;
}

export async function deriveAccountsCommand(
  options: {
    programType: string;
    programId: string;
    mint: string;
    poolProgramId?: string;
    remoteChainSelector?: string;
  },
  command: {
    parent?: {
      parent?: { opts(): { resolvedRpcUrl?: string } };
      opts(): { resolvedRpcUrl?: string };
    };
  }
): Promise<void> {
  const commandLogger = createChildLogger(logger, { command: 'derive-accounts' });

  try {
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};

    // Log command start with structured data
    commandLogger.info(
      {
        programType: options.programType,
        programId: options.programId,
        mint: options.mint,
        poolProgramId: options.poolProgramId,
        remoteChainSelector: options.remoteChainSelector,
        globalOptions,
      },
      'Starting deriveAccounts command'
    );

    const args = {
      programType: options.programType,
      programId: options.programId,
      mint: options.mint,
      poolProgramId: options.poolProgramId,
      remoteChainSelector: options.remoteChainSelector,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    };

    const validation = validateArgs(DeriveAccountsArgsSchema, args);
    if (!validation.success) {
      const errorMessage = `Invalid arguments: ${validation.errors.join(', ')}`;
      commandLogger.error(errorMessage);
      console.error(`❌ ${errorMessage}`);
      console.error('💡 Expected format:');
      console.error(
        '   • Program Type: burnmint-token-pool, lockrelease-token-pool, router, or spl-token'
      );
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • Pool Program ID: Base58 public key (optional, for router)');
      console.error('   • Remote Chain Selector: Number (optional, for chain configs)');
      process.exit(1);
    }

    const validatedArgs = validation.data;
    const { programType, programId, mint, poolProgramId, remoteChainSelector, rpcUrl } =
      validatedArgs;

    const connection = createConnection(rpcUrl);
    const accounts: DerivedAccount[] = [];

    console.log(`🔍 Deriving ${programType} accounts...`);

    switch (programType) {
      case 'burnmint-token-pool':
        await deriveBurnmintAccounts(accounts, programId, mint, connection, remoteChainSelector);
        break;
      case 'lockrelease-token-pool':
        await deriveLockreleaseAccounts(accounts, programId, mint, connection, remoteChainSelector);
        break;
      case 'router':
        await deriveRouterAccounts(accounts, programId, mint, poolProgramId);
        break;
      case 'spl-token':
        await deriveSplTokenAccounts(accounts, mint, connection);
        break;
    }

    if ((globalOptions as { json?: boolean }).json) {
      emitJson(
        stateEnvelope({
          kind: 'derived-accounts',
          globalOptions,
          data: { programType, accounts: toJsonSafe(accounts) },
        })
      );
    } else {
      displayAccountsTable(accounts, programType);
    }

    commandLogger.info('✅ Account derivation completed successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    commandLogger.error(`❌ Failed to derive accounts: ${message}`);
    if (error instanceof Error && error.stack) {
      commandLogger.error({ stack: error.stack }, 'Stack trace');
    }
    process.exit(1);
  }
}

async function deriveBurnmintAccounts(
  accounts: DerivedAccount[],
  programId: PublicKey,
  mint: PublicKey,
  connection: Connection,
  remoteChainSelector?: bigint
): Promise<void> {
  // Pool State PDA
  const [statePda, stateBump] = BurnmintDerivation.deriveStatePda(programId, mint);
  accounts.push({
    name: 'Pool State PDA',
    address: statePda.toString(),
    seeds: `["${BURNMINT_TOKEN_POOL.STATE_SEED}", mint]`,
    bump: stateBump,
    description: 'Main pool configuration account (created by initialize-pool)',
  });

  // Pool Signer PDA - THE CRITICAL ONE!
  const [poolSignerPda, signerBump] = BurnmintDerivation.derivePoolSignerPda(programId, mint);
  accounts.push({
    name: 'Pool Signer PDA',
    address: poolSignerPda.toString(),
    seeds: `["${BURNMINT_TOKEN_POOL.POOL_SIGNER_SEED}", mint]`,
    bump: signerBump,
    description: '🎯 CRITICAL: Autonomous mint/burn authority for cross-chain operations',
  });

  // Global Config PDA
  const [globalConfigPda, globalBump] = BurnmintDerivation.deriveGlobalConfigPda(programId);
  accounts.push({
    name: 'Global Config PDA',
    address: globalConfigPda.toString(),
    seeds: `["${BURNMINT_TOKEN_POOL.CONFIG_SEED}"]`,
    bump: globalBump,
    description: 'Program-wide configuration settings',
  });

  // Pool Token ATA (where the pool holds tokens)
  const tokenProgramId = await detectTokenProgramId(connection, mint);
  const poolTokenAta = getAssociatedTokenAddressSync(mint, poolSignerPda, true, tokenProgramId);
  accounts.push({
    name: 'Pool Token ATA',
    address: poolTokenAta.toString(),
    seeds: '[mint, pool_signer_pda, token_program]',
    description: "Pool's token account (owned by Pool Signer PDA)",
  });

  // Chain Config PDA (if chain selector provided)
  if (remoteChainSelector) {
    const [chainConfigPda, chainBump] = BurnmintDerivation.deriveChainConfigPda(
      programId,
      mint,
      remoteChainSelector
    );
    accounts.push({
      name: 'Chain Config PDA',
      address: chainConfigPda.toString(),
      seeds: `["${BURNMINT_TOKEN_POOL.CHAIN_CONFIG_SEED}", chain_selector, mint]`,
      bump: chainBump,
      description: `Chain configuration for selector ${remoteChainSelector}`,
    });
  }
}

async function deriveLockreleaseAccounts(
  accounts: DerivedAccount[],
  programId: PublicKey,
  mint: PublicKey,
  connection: Connection,
  remoteChainSelector?: bigint
): Promise<void> {
  // Pool State PDA
  const [statePda, stateBump] = LockreleaseDerivation.deriveStatePda(programId, mint);
  accounts.push({
    name: 'Pool State PDA',
    address: statePda.toString(),
    seeds: `["${LOCKRELEASE_TOKEN_POOL.STATE_SEED}", mint]`,
    bump: stateBump,
    description: 'Main pool configuration account (created by initialize-pool)',
  });

  // Pool Signer PDA - THE CRITICAL ONE!
  const [poolSignerPda, signerBump] = LockreleaseDerivation.derivePoolSignerPda(programId, mint);
  accounts.push({
    name: 'Pool Signer PDA',
    address: poolSignerPda.toString(),
    seeds: `["${LOCKRELEASE_TOKEN_POOL.POOL_SIGNER_SEED}", mint]`,
    bump: signerBump,
    description: '🎯 CRITICAL: Autonomous liquidity authority for cross-chain operations',
  });

  // Global Config PDA
  const [globalConfigPda, globalBump] = LockreleaseDerivation.deriveGlobalConfigPda(programId);
  accounts.push({
    name: 'Global Config PDA',
    address: globalConfigPda.toString(),
    seeds: `["${LOCKRELEASE_TOKEN_POOL.CONFIG_SEED}"]`,
    bump: globalBump,
    description: 'Program-wide configuration settings',
  });

  // Pool Token ATA (where the pool holds liquidity)
  const tokenProgramId = await detectTokenProgramId(connection, mint);
  const poolTokenAta = LockreleaseDerivation.derivePoolTokenAccount(
    programId,
    mint,
    tokenProgramId
  );
  accounts.push({
    name: 'Pool Token ATA',
    address: poolTokenAta.toString(),
    seeds: '[mint, pool_signer_pda, token_program]',
    description: "Pool's token account (holds liquidity, owned by Pool Signer PDA)",
  });

  // Chain Config PDA (if chain selector provided)
  if (remoteChainSelector) {
    const [chainConfigPda, chainBump] = LockreleaseDerivation.deriveChainConfigPda(
      programId,
      mint,
      remoteChainSelector
    );
    accounts.push({
      name: 'Chain Config PDA',
      address: chainConfigPda.toString(),
      seeds: `["${LOCKRELEASE_TOKEN_POOL.CHAIN_CONFIG_SEED}", chain_selector, mint]`,
      bump: chainBump,
      description: `Chain configuration for selector ${remoteChainSelector}`,
    });
  }
}

async function deriveRouterAccounts(
  accounts: DerivedAccount[],
  programId: PublicKey,
  mint: PublicKey,
  poolProgramId?: PublicKey
): Promise<void> {
  // Token Admin Registry PDA
  const [registryPda, registryBump] = RouterDerivation.deriveTokenAdminRegistryPda(programId, mint);
  accounts.push({
    name: 'Token Admin Registry PDA',
    address: registryPda.toString(),
    seeds: `["${ROUTER_SEEDS.TOKEN_ADMIN_REGISTRY}", mint]`,
    bump: registryBump,
    description: 'Token admin registry for pool configuration',
  });

  // Router Config PDA
  const [configPda, configBump] = RouterDerivation.deriveConfigPda(programId);
  accounts.push({
    name: 'Router Config PDA',
    address: configPda.toString(),
    seeds: `["${ROUTER_SEEDS.CONFIG}"]`,
    bump: configBump,
    description: 'Global router configuration',
  });

  // External Token Pools Signer PDA (if pool program provided)
  if (poolProgramId) {
    const [poolSignerPda, poolSignerBump] = RouterDerivation.deriveExternalTokenPoolsSignerPda(
      programId,
      poolProgramId
    );
    accounts.push({
      name: 'Router Pool Signer PDA',
      address: poolSignerPda.toString(),
      seeds: `["${ROUTER_SEEDS.EXTERNAL_TOKEN_POOLS_SIGNER}", pool_program_id]`,
      bump: poolSignerBump,
      description: "Router's authority for calling pool programs",
    });
  }
}

async function deriveSplTokenAccounts(
  accounts: DerivedAccount[],
  mint: PublicKey,
  connection: Connection
): Promise<void> {
  const tokenProgramId = await detectTokenProgramId(connection, mint);

  accounts.push({
    name: 'Token Program ID',
    address: tokenProgramId.toString(),
    seeds: 'N/A (program address)',
    description: 'Detected token program (SPL Token or Token-2022)',
  });

  accounts.push({
    name: 'Token Mint',
    address: mint.toString(),
    seeds: 'N/A (provided)',
    description: 'Token mint account',
  });

  // An ATA needs an owner nobody passed, so there is no address. Leave the field empty rather than
  // prose: `address` is a base58 key in every other row, and `new PublicKey(a.address)` would throw
  // on this one alone.
  accounts.push({
    name: 'ATA Pattern',
    address: '',
    seeds: '[owner, token_program, mint]',
    description:
      'Associated Token Account derivation pattern - derive per owner with ' +
      'getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve, tokenProgram)',
  });
}

function displayAccountsTable(accounts: DerivedAccount[], programType?: string): void {
  console.log('\n📊 Derived Accounts:\n');

  accounts.forEach((account, index) => {
    console.log(`${index + 1}. ${account.name}`);
    console.log(`   Address: ${account.address}`);
    console.log(`   Seeds: ${account.seeds}`);
    if (account.bump !== undefined) {
      console.log(`   Bump: ${account.bump}`);
    }
    console.log(`   Description: ${account.description}`);
    console.log('');
  });

  // Highlight the Pool Signer PDA with context-specific message
  const poolSigner = accounts.find(acc => acc.name === 'Pool Signer PDA');
  if (poolSigner) {
    console.log('🎯 CRITICAL ADDRESS FOR CROSS-CHAIN OPERATIONS:');
    console.log(`   Pool Signer PDA: ${poolSigner.address}`);

    if (programType === 'lockrelease-token-pool') {
      console.log(
        '   ↳ This address signs token transfers for lock/release operations autonomously'
      );
    } else if (programType === 'burnmint-token-pool') {
      console.log('   ↳ This address signs all mint/burn transactions autonomously');
    } else {
      console.log('   ↳ This address signs token operations autonomously');
    }
    console.log('');
  }
}
