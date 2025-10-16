import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { BurnmintTokenPoolAccounts } from './accounts.js';
import { logger } from '../../utils/logger.js';
import { AnchorUtils } from '../../utils/anchor.js';
import type { Idl } from '../../types/index.js';
import { hexToBytes, hexToPadded32Bytes } from '../../utils/addresses.js';

/**
 * Instruction builder for burnmint_token_pool program using Anchor
 */
export class InstructionBuilder {
  private programId: PublicKey;
  private idl: Idl;

  constructor(programId: PublicKey, idl: Idl) {
    this.programId = programId;
    this.idl = idl;
  }

  /**
   * Initialize the pool state for a given mint
   */
  async initialize(mint: PublicKey, authority: PublicKey): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        programId: this.programId.toString(),
      },
      'Building initialize (pool state) instruction with Anchor'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'initialize');

    const accounts = BurnmintTokenPoolAccounts.initialize(this.programId, mint, authority).build();

    const instruction = AnchorUtils.buildInstruction('initialize', this.programId, accounts);

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
        accountsLength: accounts.length,
      },
      'Generated real Anchor instruction'
    );

    return instruction;
  }

  /**
   * Create acceptOwnership instruction using Anchor
   * @param mint The mint public key
   * @param authority The new authority public key
   * @returns Transaction instruction
   */
  async acceptOwnership(mint: PublicKey, authority: PublicKey): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        programId: this.programId.toString(),
      },
      'Building acceptOwnership instruction with Anchor'
    );

    // Validate instruction exists in IDL
    AnchorUtils.validateInstructionExists(this.idl, 'acceptOwnership');

    // Derive accounts using our existing logic
    const accounts = BurnmintTokenPoolAccounts.acceptOwnership(
      this.programId,
      mint,
      authority
    ).build();

    logger.debug(
      {
        stateAccount: accounts[0]?.pubkey?.toString(),
        mintAccount: accounts[1]?.pubkey?.toString(),
        authorityAccount: accounts[2]?.pubkey?.toString(),
        accountsLength: accounts.length,
      },
      'Account details before instruction building'
    );

    // Build instruction using the reusable utility
    // Use snake_case as that's what Anchor expects internally
    const instruction = AnchorUtils.buildInstruction('accept_ownership', this.programId, accounts);

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated real Anchor instruction'
    );

    return instruction;
  }

  /**
   * Create setRateLimitAdmin instruction using Anchor
   * @param mint The mint public key
   * @param authority The current authority public key
   * @param newRateLimitAdmin The new rate limit admin public key
   * @returns Transaction instruction
   */
  async setRateLimitAdmin(
    mint: PublicKey,
    authority: PublicKey,
    newRateLimitAdmin: PublicKey
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        newRateLimitAdmin: newRateLimitAdmin.toString(),
        programId: this.programId.toString(),
      },
      'Building setRateLimitAdmin instruction with Anchor'
    );

    // Validate instruction exists in IDL
    AnchorUtils.validateInstructionExists(this.idl, 'setRateLimitAdmin');

    // Derive accounts using our existing logic
    const accounts = BurnmintTokenPoolAccounts.setRateLimitAdmin(
      this.programId,
      mint,
      authority
    ).build();

    logger.debug(
      {
        stateAccount: accounts[0]?.pubkey?.toString(),
        authorityAccount: accounts[1]?.pubkey?.toString(),
        accountsLength: accounts.length,
      },
      'Account details before instruction building'
    );

    // Serialize instruction data - mint (32 bytes) + newRateLimitAdmin (32 bytes) = 64 bytes
    const instructionDataBuffer = Buffer.alloc(64);
    mint.toBuffer().copy(instructionDataBuffer, 0);
    newRateLimitAdmin.toBuffer().copy(instructionDataBuffer, 32);

    // Build instruction using the reusable utility
    const instruction = AnchorUtils.buildInstruction(
      'set_rate_limit_admin',
      this.programId,
      accounts,
      instructionDataBuffer
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated real Anchor instruction'
    );

    return instruction;
  }

  /**
   * Create setChainRateLimit instruction using Anchor
   * @param mint The mint public key
   * @param authority The authority public key
   * @param remoteChainSelector The remote chain selector
   * @param inboundRateLimit The inbound rate limit configuration
   * @param outboundRateLimit The outbound rate limit configuration
   * @returns Transaction instruction
   */
  async setChainRateLimit(
    mint: PublicKey,
    authority: PublicKey,
    remoteChainSelector: bigint,
    inboundRateLimit: { enabled: boolean; capacity: bigint; rate: bigint },
    outboundRateLimit: { enabled: boolean; capacity: bigint; rate: bigint }
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        programId: this.programId.toString(),
        remoteChainSelector: remoteChainSelector.toString(),
        inboundRateLimit,
        outboundRateLimit,
      },
      'Building setChainRateLimit instruction with Anchor'
    );

    // Validate instruction exists in IDL
    AnchorUtils.validateInstructionExists(this.idl, 'setChainRateLimit');

    // Derive accounts using our existing logic
    const accounts = BurnmintTokenPoolAccounts.setChainRateLimit(
      this.programId,
      mint,
      authority,
      remoteChainSelector
    ).build();

    logger.debug(
      {
        stateAccount: accounts[0]?.pubkey?.toString(),
        chainConfigAccount: accounts[1]?.pubkey?.toString(),
        authorityAccount: accounts[2]?.pubkey?.toString(),
        accountsLength: accounts.length,
      },
      'Account details before instruction building'
    );

    // Serialize instruction data based on IDL structure
    // Complete instruction data layout (82 bytes total):
    // Bytes 0-7:    [188, 188, 161, 37, 100, 249, 123, 170]  // Discriminator (added automatically)
    // Bytes 8-15:   Chain selector as u64 LE                   // remoteChainSelector
    // Bytes 16-47:  Token mint as PublicKey                    // mint
    // Bytes 48:     Inbound enabled (bool)                     // 1 byte
    // Bytes 49-56:  Inbound capacity as u64 LE                 // 8 bytes
    // Bytes 57-64:  Inbound rate as u64 LE                     // 8 bytes
    // Bytes 65:     Outbound enabled (bool)                    // 1 byte
    // Bytes 66-73:  Outbound capacity as u64 LE                // 8 bytes
    // Bytes 74-81:  Outbound rate as u64 LE                    // 8 bytes

    // Allocate buffer for instruction data (74 bytes - discriminator added separately by AnchorUtils)
    const instructionDataBuffer = Buffer.alloc(8 + 32 + (1 + 8 + 8) + (1 + 8 + 8)); // 74 bytes
    let offset = 0;

    // Write remote chain selector (u64, little-endian)
    instructionDataBuffer.writeBigUInt64LE(remoteChainSelector, offset);
    offset += 8;

    // Write mint (32 bytes)
    mint.toBuffer().copy(instructionDataBuffer, offset);
    offset += 32;

    // Write inbound rate limit config
    instructionDataBuffer.writeUInt8(inboundRateLimit.enabled ? 1 : 0, offset);
    offset += 1;
    instructionDataBuffer.writeBigUInt64LE(inboundRateLimit.capacity, offset);
    offset += 8;
    instructionDataBuffer.writeBigUInt64LE(inboundRateLimit.rate, offset);
    offset += 8;

    // Write outbound rate limit config
    instructionDataBuffer.writeUInt8(outboundRateLimit.enabled ? 1 : 0, offset);
    offset += 1;
    instructionDataBuffer.writeBigUInt64LE(outboundRateLimit.capacity, offset);
    offset += 8;
    instructionDataBuffer.writeBigUInt64LE(outboundRateLimit.rate, offset);

    // Build instruction using the reusable utility
    // Use snake_case as that's what Anchor expects internally
    const instruction = AnchorUtils.buildInstruction(
      'set_chain_rate_limit',
      this.programId,
      accounts,
      instructionDataBuffer
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated real Anchor instruction'
    );

    return instruction;
  }

  /**
   * Create transferOwnership instruction using Anchor
   * @param mint The mint public key
   * @param authority The current authority public key
   * @param proposedOwner The new proposed owner public key
   * @returns Transaction instruction
   */
  async transferOwnership(
    mint: PublicKey,
    authority: PublicKey,
    proposedOwner: PublicKey
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        proposedOwner: proposedOwner.toString(),
        programId: this.programId.toString(),
      },
      'Building transferOwnership instruction with Anchor'
    );

    // Validate instruction exists in IDL
    AnchorUtils.validateInstructionExists(this.idl, 'transferOwnership');

    // Derive accounts using our existing logic
    const accounts = BurnmintTokenPoolAccounts.transferOwnership(
      this.programId,
      mint,
      authority
    ).build();

    logger.debug(
      {
        stateAccount: accounts[0]?.pubkey?.toString(),
        mintAccount: accounts[1]?.pubkey?.toString(),
        authorityAccount: accounts[2]?.pubkey?.toString(),
        accountsLength: accounts.length,
      },
      'Account details before instruction building'
    );

    // Serialize instruction data - just the proposed owner (32 bytes)
    const instructionDataBuffer = Buffer.alloc(32);
    proposedOwner.toBuffer().copy(instructionDataBuffer, 0);

    // Build instruction using the reusable utility
    const instruction = AnchorUtils.buildInstruction(
      'transfer_ownership',
      this.programId,
      accounts,
      instructionDataBuffer
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated real Anchor instruction'
    );

    return instruction;
  }

  /**
   * Create initChainRemoteConfig instruction using Anchor
   * @param mint The mint public key
   * @param authority The authority public key
   * @param remoteChainSelector The remote chain selector
   * @param poolAddresses Array of remote pool addresses
   * @param tokenAddress Remote token address
   * @param decimals Token decimals
   * @returns Transaction instruction
   */
  async initChainRemoteConfig(
    mint: PublicKey,
    authority: PublicKey,
    remoteChainSelector: bigint,
    poolAddresses: string[],
    tokenAddress: string,
    decimals: number
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        programId: this.programId.toString(),
        remoteChainSelector: remoteChainSelector.toString(),
        poolAddresses,
        tokenAddress,
        decimals,
      },
      'Building initChainRemoteConfig instruction with Anchor'
    );

    // Validate instruction exists in IDL
    AnchorUtils.validateInstructionExists(this.idl, 'initChainRemoteConfig');

    // Derive accounts using our existing logic
    const accounts = BurnmintTokenPoolAccounts.initChainRemoteConfig(
      this.programId,
      mint,
      authority,
      remoteChainSelector
    ).build();

    logger.debug(
      {
        stateAccount: accounts[0]?.pubkey?.toString(),
        chainConfigAccount: accounts[1]?.pubkey?.toString(),
        authorityAccount: accounts[2]?.pubkey?.toString(),
        systemProgram: accounts[3]?.pubkey?.toString(),
        accountsLength: accounts.length,
      },
      'Account details before instruction building'
    );

    // Serialize instruction data
    // Structure: chainSelector (8) + mint (32) + RemoteConfig
    // RemoteConfig: poolAddresses (vec) + tokenAddress + decimals
    const buffers: Buffer[] = [];

    // Chain selector (u64)
    const chainSelectorBuffer = Buffer.alloc(8);
    chainSelectorBuffer.writeBigUInt64LE(remoteChainSelector);
    buffers.push(chainSelectorBuffer);

    // Mint (32 bytes)
    buffers.push(mint.toBuffer());

    // Pool addresses as vec of RemoteAddress
    const poolAddressesLenBuffer = Buffer.alloc(4);
    poolAddressesLenBuffer.writeUInt32LE(poolAddresses.length);
    buffers.push(poolAddressesLenBuffer);

    for (const addr of poolAddresses) {
      const addrBytes = hexToBytes(addr);
      const lenBuffer = Buffer.alloc(4);
      lenBuffer.writeUInt32LE(addrBytes.length);
      buffers.push(lenBuffer);
      buffers.push(addrBytes);
    }

    // Token address as RemoteAddress (left-pad to 32 bytes)
    const tokenAddrBytes = hexToPadded32Bytes(tokenAddress);
    const tokenLenBuffer = Buffer.alloc(4);
    tokenLenBuffer.writeUInt32LE(tokenAddrBytes.length);
    buffers.push(tokenLenBuffer);
    buffers.push(tokenAddrBytes);

    // Decimals (u8)
    buffers.push(Buffer.from([decimals]));

    const instructionDataBuffer = Buffer.concat(buffers);

    // Build instruction using the reusable utility
    const instruction = AnchorUtils.buildInstruction(
      'init_chain_remote_config',
      this.programId,
      accounts,
      instructionDataBuffer
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated real Anchor instruction'
    );

    return instruction;
  }

  /**
   * Create editChainRemoteConfig instruction using Anchor
   * @param mint The mint public key
   * @param authority The authority public key
   * @param remoteChainSelector The remote chain selector
   * @param poolAddresses Array of remote pool addresses
   * @param tokenAddress Remote token address
   * @param decimals Token decimals
   * @returns Transaction instruction
   */
  async editChainRemoteConfig(
    mint: PublicKey,
    authority: PublicKey,
    remoteChainSelector: bigint,
    poolAddresses: string[],
    tokenAddress: string,
    decimals: number
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        programId: this.programId.toString(),
        remoteChainSelector: remoteChainSelector.toString(),
        poolAddresses,
        tokenAddress,
        decimals,
      },
      'Building editChainRemoteConfig instruction with Anchor'
    );

    // Validate instruction exists in IDL
    AnchorUtils.validateInstructionExists(this.idl, 'editChainRemoteConfig');

    // Derive accounts using our existing logic
    const accounts = BurnmintTokenPoolAccounts.editChainRemoteConfig(
      this.programId,
      mint,
      authority,
      remoteChainSelector
    ).build();

    // Same data serialization as initChainRemoteConfig
    const buffers: Buffer[] = [];

    // Chain selector (u64)
    const chainSelectorBuffer = Buffer.alloc(8);
    chainSelectorBuffer.writeBigUInt64LE(remoteChainSelector);
    buffers.push(chainSelectorBuffer);

    // Mint (32 bytes)
    buffers.push(mint.toBuffer());

    // Pool addresses as vec of RemoteAddress
    const poolAddressesLenBuffer = Buffer.alloc(4);
    poolAddressesLenBuffer.writeUInt32LE(poolAddresses.length);
    buffers.push(poolAddressesLenBuffer);

    for (const addr of poolAddresses) {
      const addrBytes = hexToBytes(addr);
      const lenBuffer = Buffer.alloc(4);
      lenBuffer.writeUInt32LE(addrBytes.length);
      buffers.push(lenBuffer);
      buffers.push(addrBytes);
    }

    // Token address as RemoteAddress (left-pad to 32 bytes)
    const tokenAddrBytes = hexToPadded32Bytes(tokenAddress);
    const tokenLenBuffer = Buffer.alloc(4);
    tokenLenBuffer.writeUInt32LE(tokenAddrBytes.length);
    buffers.push(tokenLenBuffer);
    buffers.push(tokenAddrBytes);

    // Decimals (u8)
    buffers.push(Buffer.from([decimals]));

    const instructionDataBuffer = Buffer.concat(buffers);

    // Build instruction using the reusable utility
    const instruction = AnchorUtils.buildInstruction(
      'edit_chain_remote_config',
      this.programId,
      accounts,
      instructionDataBuffer
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated real Anchor instruction'
    );

    return instruction;
  }

  /**
   * Create appendRemotePoolAddresses instruction using Anchor
   * @param mint The mint public key
   * @param authority The authority public key
   * @param remoteChainSelector The remote chain selector
   * @param addresses Array of remote addresses to append
   * @returns Transaction instruction
   */
  async appendRemotePoolAddresses(
    mint: PublicKey,
    authority: PublicKey,
    remoteChainSelector: bigint,
    addresses: string[]
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        programId: this.programId.toString(),
        remoteChainSelector: remoteChainSelector.toString(),
        addresses,
      },
      'Building appendRemotePoolAddresses instruction with Anchor'
    );

    // Validate instruction exists in IDL
    AnchorUtils.validateInstructionExists(this.idl, 'appendRemotePoolAddresses');

    // Derive accounts using our existing logic
    const accounts = BurnmintTokenPoolAccounts.appendRemotePoolAddresses(
      this.programId,
      mint,
      authority,
      remoteChainSelector
    ).build();

    // Serialize instruction data
    const buffers: Buffer[] = [];

    // Chain selector (u64)
    const chainSelectorBuffer = Buffer.alloc(8);
    chainSelectorBuffer.writeBigUInt64LE(remoteChainSelector);
    buffers.push(chainSelectorBuffer);

    // Mint (32 bytes)
    buffers.push(mint.toBuffer());

    // Addresses as vec of RemoteAddress
    const addressesLenBuffer = Buffer.alloc(4);
    addressesLenBuffer.writeUInt32LE(addresses.length);
    buffers.push(addressesLenBuffer);

    for (const addr of addresses) {
      const addrBytes = hexToBytes(addr);
      const lenBuffer = Buffer.alloc(4);
      lenBuffer.writeUInt32LE(addrBytes.length);
      buffers.push(lenBuffer);
      buffers.push(addrBytes);
    }

    const instructionDataBuffer = Buffer.concat(buffers);

    // Build instruction using the reusable utility
    const instruction = AnchorUtils.buildInstruction(
      'append_remote_pool_addresses',
      this.programId,
      accounts,
      instructionDataBuffer
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated real Anchor instruction'
    );

    return instruction;
  }

  /**
   * Create deleteChainConfig instruction using Anchor
   * @param mint The mint public key
   * @param authority The authority public key
   * @param remoteChainSelector The remote chain selector
   * @returns Transaction instruction
   */
  async deleteChainConfig(
    mint: PublicKey,
    authority: PublicKey,
    remoteChainSelector: bigint
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        programId: this.programId.toString(),
        remoteChainSelector: remoteChainSelector.toString(),
      },
      'Building deleteChainConfig instruction with Anchor'
    );

    // Validate instruction exists in IDL
    AnchorUtils.validateInstructionExists(this.idl, 'deleteChainConfig');

    // Derive accounts using our existing logic
    const accounts = BurnmintTokenPoolAccounts.deleteChainConfig(
      this.programId,
      mint,
      authority,
      remoteChainSelector
    ).build();

    // Serialize instruction data
    const buffers: Buffer[] = [];

    // Chain selector (u64)
    const chainSelectorBuffer = Buffer.alloc(8);
    chainSelectorBuffer.writeBigUInt64LE(remoteChainSelector);
    buffers.push(chainSelectorBuffer);

    // Mint (32 bytes)
    buffers.push(mint.toBuffer());

    const instructionDataBuffer = Buffer.concat(buffers);

    // Build instruction using the reusable utility
    const instruction = AnchorUtils.buildInstruction(
      'delete_chain_config',
      this.programId,
      accounts,
      instructionDataBuffer
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated real Anchor instruction'
    );

    return instruction;
  }

  /**
   * Create configureAllowList instruction using Anchor
   * @param mint The mint public key
   * @param authority The authority public key
   * @param add Array of addresses to add to allow list
   * @param enabled Whether the allow list is enabled
   * @returns Transaction instruction
   */
  async configureAllowList(
    mint: PublicKey,
    authority: PublicKey,
    add: PublicKey[],
    enabled: boolean
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        programId: this.programId.toString(),
        add: add.map(a => a.toString()),
        enabled,
      },
      'Building configureAllowList instruction with Anchor'
    );

    // Validate instruction exists in IDL
    AnchorUtils.validateInstructionExists(this.idl, 'configureAllowList');

    // Derive accounts using our existing logic
    const accounts = BurnmintTokenPoolAccounts.configureAllowList(
      this.programId,
      mint,
      authority
    ).build();

    // Serialize instruction data
    const buffers: Buffer[] = [];

    // Add addresses as vec of PublicKey
    const addLenBuffer = Buffer.alloc(4);
    addLenBuffer.writeUInt32LE(add.length);
    buffers.push(addLenBuffer);

    for (const addr of add) {
      buffers.push(addr.toBuffer());
    }

    // Enabled (bool)
    buffers.push(Buffer.from([enabled ? 1 : 0]));

    const instructionDataBuffer = Buffer.concat(buffers);

    // Build instruction using the reusable utility
    const instruction = AnchorUtils.buildInstruction(
      'configure_allow_list',
      this.programId,
      accounts,
      instructionDataBuffer
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated real Anchor instruction'
    );

    return instruction;
  }

  /**
   * Create removeFromAllowList instruction using Anchor
   * @param mint The mint public key
   * @param authority The authority public key
   * @param remove Array of addresses to remove from allow list
   * @returns Transaction instruction
   */
  async removeFromAllowList(
    mint: PublicKey,
    authority: PublicKey,
    remove: PublicKey[]
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        programId: this.programId.toString(),
        remove: remove.map(r => r.toString()),
      },
      'Building removeFromAllowList instruction with Anchor'
    );

    // Validate instruction exists in IDL
    AnchorUtils.validateInstructionExists(this.idl, 'removeFromAllowList');

    // Derive accounts using our existing logic
    const accounts = BurnmintTokenPoolAccounts.removeFromAllowList(
      this.programId,
      mint,
      authority
    ).build();

    // Serialize instruction data
    const buffers: Buffer[] = [];

    // Remove addresses as vec of PublicKey
    const removeLenBuffer = Buffer.alloc(4);
    removeLenBuffer.writeUInt32LE(remove.length);
    buffers.push(removeLenBuffer);

    for (const addr of remove) {
      buffers.push(addr.toBuffer());
    }

    const instructionDataBuffer = Buffer.concat(buffers);

    // Build instruction using the reusable utility
    const instruction = AnchorUtils.buildInstruction(
      'remove_from_allow_list',
      this.programId,
      accounts,
      instructionDataBuffer
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated real Anchor instruction'
    );

    return instruction;
  }
}
