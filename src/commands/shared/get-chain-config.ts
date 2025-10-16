import { Connection, PublicKey } from '@solana/web3.js';
import { GetChainConfigArgsSchema } from '../../types/index.js';
import { validateArgs } from '../../utils/validation.js';
import { createChildLogger, logger } from '../../utils/logger.js';
import { getProgramConfig, type ProgramName } from '../../types/program-registry.js';
import type { CommandContext, GetChainConfigOptions } from '../../types/command.js';
import { AccountDerivation as BurnmintDerivation } from '../../programs/burnmint-token-pool/accounts.js';
import { AccountDerivation as LockreleaseDerivation } from '../../programs/lockrelease-token-pool/accounts.js';

/**
 * Shared get chain config implementation for reading on-chain ChainConfig accounts
 */
export async function getChainConfig(
  options: GetChainConfigOptions,
  command: CommandContext,
  programType: ProgramName
): Promise<void> {
  const cmdLogger = createChildLogger(logger, {
    command: `${programType}.get-chain-config`,
  });

  try {
    // Get global options and program config
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};
    const programConfig = getProgramConfig(programType);

    if (!programConfig?.idl) {
      console.error(`❌ ${programConfig.displayName} IDL not available`);
      process.exit(1);
    }

    // Validate arguments
    const parsed = validateArgs(GetChainConfigArgsSchema, {
      programId: options.programId,
      mint: options.mint,
      remoteChainSelector: options.remoteChainSelector,
      rpcUrl: globalOptions.resolvedRpcUrl!,
    });

    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      console.error('💡 Expected format:');
      console.error('   • Program ID: Base58 public key (44 characters)');
      console.error('   • Mint: Base58 public key (44 characters)');
      console.error('   • Remote Chain Selector: Positive integer');
      console.error('   • RPC URL: Valid HTTP/HTTPS URL');
      process.exit(1);
    }

    const { programId, mint, remoteChainSelector, rpcUrl } = parsed.data;

    // Derive chain config PDA based on program type
    let chainConfigPda: PublicKey;
    if (programType === 'burnmint-token-pool') {
      [chainConfigPda] = BurnmintDerivation.deriveChainConfigPda(
        programId,
        mint,
        remoteChainSelector
      );
    } else if (programType === 'lockrelease-token-pool') {
      [chainConfigPda] = LockreleaseDerivation.deriveChainConfigPda(
        programId,
        mint,
        remoteChainSelector
      );
    } else {
      throw new Error(`Unsupported program type: ${programType}`);
    }

    cmdLogger.debug(
      {
        programId: programId.toString(),
        mint: mint.toString(),
        remoteChainSelector: remoteChainSelector.toString(),
        chainConfigPda: chainConfigPda.toString(),
      },
      'Fetching chain config account'
    );

    console.log('🔍 Reading chain configuration...');
    console.log(`   RPC URL: ${rpcUrl}`);
    console.log(`   Program ID: ${programId.toString()}`);
    console.log(`   Mint: ${mint.toString()}`);
    console.log(`   Remote Chain Selector: ${remoteChainSelector.toString()}`);
    console.log(`   Chain Config PDA: ${chainConfigPda.toString()}`);

    // Fetch account data from blockchain
    const connection = new Connection(rpcUrl as string);
    const accountInfo = await connection.getAccountInfo(chainConfigPda);

    if (!accountInfo) {
      console.error('❌ Chain config account not found');
      console.error('💡 This remote chain may not be configured yet.');
      console.error('💡 Run the init-chain-remote-config instruction first.');
      cmdLogger.error(
        { chainConfigPda: chainConfigPda.toString() },
        'Chain config account does not exist'
      );
      process.exit(1);
    }

    cmdLogger.debug(
      {
        accountDataLength: accountInfo.data.length,
        owner: accountInfo.owner.toString(),
      },
      'Account data retrieved'
    );

    console.log('✅ Chain config account found');
    console.log('');

    // Fetch mint account to get local token decimals (rate limits use local units)
    cmdLogger.debug({ mint: mint.toString() }, 'Fetching mint account for decimals');
    const mintInfo = await connection.getAccountInfo(mint);

    if (!mintInfo) {
      console.error('❌ Mint account not found');
      cmdLogger.error({ mint: mint.toString() }, 'Mint account does not exist');
      process.exit(1);
    }

    // Read decimals from mint account (offset 44 for both SPL Token and Token-2022)
    const localDecimals = mintInfo.data.readUInt8(44);

    cmdLogger.debug(
      {
        localDecimals,
        mintOwner: mintInfo.owner.toString(),
      },
      'Local token decimals retrieved from mint'
    );

    // Deserialize account data manually
    const chainConfig = deserializeChainConfigAccount(accountInfo.data);

    cmdLogger.debug(
      {
        chainConfig,
        note: 'Rate limits are in local token units, remote config shows destination token info',
      },
      'Chain config account deserialized successfully'
    );

    // Display formatted output
    displayChainConfig(
      chainConfig,
      programType,
      programId,
      chainConfigPda,
      remoteChainSelector,
      localDecimals,
      mint
    );

    cmdLogger.info('getChainConfig command completed successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cmdLogger.error({ error: message }, 'getChainConfig failed');

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
 * Remote address structure
 */
interface RemoteAddress {
  address: string; // Hex-encoded
  length: number; // Byte length
}

/**
 * Rate limit token bucket structure
 */
interface RateLimitTokenBucket {
  tokens: bigint;
  lastUpdated: bigint;
  config: {
    enabled: boolean;
    capacity: bigint;
    rate: bigint;
  };
}

/**
 * Chain config account structure
 */
interface ChainConfigAccount {
  base: {
    remote: {
      poolAddresses: RemoteAddress[];
      tokenAddress: RemoteAddress;
      decimals: number;
    };
    inboundRateLimit: RateLimitTokenBucket;
    outboundRateLimit: RateLimitTokenBucket;
  };
}

/**
 * Manually deserialize ChainConfig account data
 * Avoids BorshAccountsCoder issues with incomplete IDL types
 *
 * @param data - Raw account data buffer from the blockchain
 * @returns Deserialized chain config account object
 */
function deserializeChainConfigAccount(data: Buffer): ChainConfigAccount {
  let offset = 8; // Skip 8-byte Anchor discriminator

  // Read pool_addresses (Vec<RemoteAddress>)
  const poolAddressesLength = data.readUInt32LE(offset);
  offset += 4;

  const poolAddresses: RemoteAddress[] = [];
  for (let i = 0; i < poolAddressesLength; i++) {
    const addrLen = data.readUInt32LE(offset);
    offset += 4;
    const addrBytes = data.subarray(offset, offset + addrLen);
    poolAddresses.push({
      address: `0x${addrBytes.toString('hex')}`,
      length: addrLen,
    });
    offset += addrLen;
  }

  // Read token_address (RemoteAddress)
  const tokenAddrLen = data.readUInt32LE(offset);
  offset += 4;
  const tokenAddrBytes = data.subarray(offset, offset + tokenAddrLen);
  const tokenAddress: RemoteAddress = {
    address: `0x${tokenAddrBytes.toString('hex')}`,
    length: tokenAddrLen,
  };
  offset += tokenAddrLen;

  // Read decimals
  const decimals = data.readUInt8(offset);
  offset += 1;

  // Read inbound rate limit (RateLimitTokenBucket)
  const inboundTokens = data.readBigUInt64LE(offset);
  offset += 8;
  const inboundLastUpdated = data.readBigUInt64LE(offset);
  offset += 8;
  const inboundEnabled = data.readUInt8(offset) === 1;
  offset += 1;
  const inboundCapacity = data.readBigUInt64LE(offset);
  offset += 8;
  const inboundRate = data.readBigUInt64LE(offset);
  offset += 8;

  // Read outbound rate limit (RateLimitTokenBucket)
  const outboundTokens = data.readBigUInt64LE(offset);
  offset += 8;
  const outboundLastUpdated = data.readBigUInt64LE(offset);
  offset += 8;
  const outboundEnabled = data.readUInt8(offset) === 1;
  offset += 1;
  const outboundCapacity = data.readBigUInt64LE(offset);
  offset += 8;
  const outboundRate = data.readBigUInt64LE(offset);
  offset += 8;

  return {
    base: {
      remote: {
        poolAddresses,
        tokenAddress,
        decimals,
      },
      inboundRateLimit: {
        tokens: inboundTokens,
        lastUpdated: inboundLastUpdated,
        config: {
          enabled: inboundEnabled,
          capacity: inboundCapacity,
          rate: inboundRate,
        },
      },
      outboundRateLimit: {
        tokens: outboundTokens,
        lastUpdated: outboundLastUpdated,
        config: {
          enabled: outboundEnabled,
          capacity: outboundCapacity,
          rate: outboundRate,
        },
      },
    },
  };
}

/**
 * Display chain config in a user-friendly format
 */
function displayChainConfig(
  config: ChainConfigAccount,
  programType: ProgramName,
  programId: PublicKey,
  chainConfigPda: PublicKey,
  remoteChainSelector: bigint,
  localDecimals: number,
  mint: PublicKey
): void {
  const { remote, inboundRateLimit, outboundRateLimit } = config.base;

  console.log(`📊 Chain Configuration for Remote Chain: ${remoteChainSelector.toString()}`);
  console.log('');

  // Program Information
  console.log('Program Information:');
  console.log(
    `  Program Type:         ${programType === 'burnmint-token-pool' ? 'Burnmint Token Pool' : 'Lockrelease Token Pool'}`
  );
  console.log(`  Program ID:           ${programId.toString()}`);
  console.log(`  Chain Config PDA:     ${chainConfigPda.toString()}`);
  console.log('');

  // Local Token Information
  console.log('Local Token (Solana):');
  console.log(`  Mint Address:         ${mint.toString()}`);
  console.log(`  Decimals:             ${localDecimals}`);
  console.log('  Note:                 Rate limits below use these decimals');
  console.log('');

  // Remote Configuration
  console.log('Remote Token (Destination Chain):');
  console.log(
    `  Token Address:        ${remote.tokenAddress.address} (${remote.tokenAddress.length} bytes)`
  );
  console.log(`  Token Decimals:       ${remote.decimals}`);
  console.log(`  Pool Addresses:       ${remote.poolAddresses.length} address(es)`);

  if (remote.poolAddresses.length === 0) {
    console.log('    (No pool addresses configured)');
  } else {
    remote.poolAddresses.forEach((addr, index) => {
      console.log(`    ${index + 1}. ${addr.address} (${addr.length} bytes)`);
    });
  }
  console.log('');

  // Inbound Rate Limit
  console.log('Inbound Rate Limit: (in local token units)');
  console.log(`  Enabled:              ${inboundRateLimit.config.enabled}`);

  if (inboundRateLimit.config.enabled) {
    const capacityFormatted = formatTokenAmount(inboundRateLimit.config.capacity, localDecimals);
    const rateFormatted = formatTokenAmount(inboundRateLimit.config.rate, localDecimals);
    const currentTokensFormatted = formatTokenAmount(inboundRateLimit.tokens, localDecimals);

    console.log(
      `  Capacity:             ${inboundRateLimit.config.capacity.toLocaleString()} (${capacityFormatted} tokens)`
    );
    console.log(
      `  Rate:                 ${inboundRateLimit.config.rate.toLocaleString()} (${rateFormatted} tokens/sec)`
    );
    console.log(
      `  Current Tokens:       ${inboundRateLimit.tokens.toLocaleString()} (${currentTokensFormatted} available)`
    );
    console.log(`  Last Updated:         ${formatTimestamp(inboundRateLimit.lastUpdated)}`);
  } else {
    console.log('  Capacity:             N/A (disabled)');
    console.log('  Rate:                 N/A (disabled)');
    console.log('  Current Tokens:       N/A (disabled)');
    console.log('  Last Updated:         N/A (disabled)');
  }
  console.log('');

  // Outbound Rate Limit
  console.log('Outbound Rate Limit: (in local token units)');
  console.log(`  Enabled:              ${outboundRateLimit.config.enabled}`);

  if (outboundRateLimit.config.enabled) {
    const capacityFormatted = formatTokenAmount(outboundRateLimit.config.capacity, localDecimals);
    const rateFormatted = formatTokenAmount(outboundRateLimit.config.rate, localDecimals);
    const currentTokensFormatted = formatTokenAmount(outboundRateLimit.tokens, localDecimals);

    console.log(
      `  Capacity:             ${outboundRateLimit.config.capacity.toLocaleString()} (${capacityFormatted} tokens)`
    );
    console.log(
      `  Rate:                 ${outboundRateLimit.config.rate.toLocaleString()} (${rateFormatted} tokens/sec)`
    );
    console.log(
      `  Current Tokens:       ${outboundRateLimit.tokens.toLocaleString()} (${currentTokensFormatted} available)`
    );
    console.log(`  Last Updated:         ${formatTimestamp(outboundRateLimit.lastUpdated)}`);
  } else {
    console.log('  Capacity:             N/A (disabled)');
    console.log('  Rate:                 N/A (disabled)');
    console.log('  Current Tokens:       N/A (disabled)');
    console.log('  Last Updated:         N/A (disabled)');
  }
  console.log('');
}

/**
 * Format token amount with decimals
 */
function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;

  // Pad fractional part with leading zeros
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');

  return `${wholePart}.${fractionalStr}`;
}

/**
 * Format Unix timestamp to human-readable date
 */
function formatTimestamp(timestamp: bigint): string {
  if (timestamp === 0n) {
    return 'Never';
  }

  const date = new Date(Number(timestamp) * 1000);
  return `${date.toISOString().replace('T', ' ').substring(0, 19)} UTC (timestamp: ${timestamp})`;
}
