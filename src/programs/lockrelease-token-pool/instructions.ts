import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { LockreleaseTokenPoolAccounts } from './accounts.js';
import { logger } from '../../utils/logger.js';
import { AnchorUtils } from '../../utils/anchor.js';
import type { Idl } from '../../types/index.js';
import { hexToBytes, hexToPadded32Bytes } from '../../utils/addresses.js';

/**
 * Instruction builder for lockrelease_token_pool program using Anchor
 * Reuses the same logic as burnmint but with snake_case naming convention
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
      'Building initialize (pool state) instruction for lockrelease'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'initialize');

    const accounts = LockreleaseTokenPoolAccounts.initialize(
      this.programId,
      mint,
      authority
    ).build();

    const instruction = AnchorUtils.buildInstruction('initialize', this.programId, accounts);

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
        accountsLength: accounts.length,
      },
      'Generated lockrelease Anchor instruction'
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
      'Building accept_ownership instruction for lockrelease'
    );

    // Validate instruction exists in IDL (using snake_case)
    AnchorUtils.validateInstructionExists(this.idl, 'accept_ownership');

    // Derive accounts using our existing logic
    const accounts = LockreleaseTokenPoolAccounts.acceptOwnership(
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

    // Build instruction using snake_case as lockrelease expects
    const instruction = AnchorUtils.buildInstruction('accept_ownership', this.programId, accounts);

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated lockrelease Anchor instruction'
    );

    return instruction;
  }

  /**
   * Transfer ownership of the pool
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
      'Building transfer_ownership instruction for lockrelease'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'transfer_ownership');

    const accounts = LockreleaseTokenPoolAccounts.transferOwnership(
      this.programId,
      mint,
      authority
    ).build();

    // Encode the proposed owner as data
    const data = proposedOwner.toBuffer();

    const instruction = AnchorUtils.buildInstruction(
      'transfer_ownership',
      this.programId,
      accounts,
      data
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated lockrelease transfer_ownership instruction'
    );

    return instruction;
  }

  /**
   * Configure allow list for the pool
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
        add: add.map(a => a.toString()),
        enabled,
        programId: this.programId.toString(),
      },
      'Building configure_allow_list instruction for lockrelease'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'configure_allow_list');

    const accounts = LockreleaseTokenPoolAccounts.configureAllowList(
      this.programId,
      mint,
      authority
    ).build();

    // Serialize instruction data to match IDL: add: Vec<Pubkey>, enabled: bool
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

    const data = Buffer.concat(buffers);

    const instruction = AnchorUtils.buildInstruction(
      'configure_allow_list',
      this.programId,
      accounts,
      data
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated lockrelease configure_allow_list instruction'
    );

    return instruction;
  }

  /**
   * Remove addresses from allow list
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
        remove: remove.map(r => r.toString()),
        programId: this.programId.toString(),
      },
      'Building remove_from_allow_list instruction for lockrelease'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'remove_from_allow_list');

    const accounts = LockreleaseTokenPoolAccounts.removeFromAllowList(
      this.programId,
      mint,
      authority
    ).build();

    // Serialize instruction data to match IDL: remove: Vec<Pubkey>
    const buffers: Buffer[] = [];

    // Remove addresses as vec of PublicKey
    const removeLenBuffer = Buffer.alloc(4);
    removeLenBuffer.writeUInt32LE(remove.length);
    buffers.push(removeLenBuffer);

    for (const addr of remove) {
      buffers.push(addr.toBuffer());
    }

    const data = Buffer.concat(buffers);

    const instruction = AnchorUtils.buildInstruction(
      'remove_from_allow_list',
      this.programId,
      accounts,
      data
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated lockrelease remove_from_allow_list instruction'
    );

    return instruction;
  }

  // Lockrelease-specific instructions

  /**
   * Provide liquidity to the pool
   */
  async provideLiquidity(
    mint: PublicKey,
    authority: PublicKey,
    amount: bigint,
    tokenProgram: PublicKey,
    userTokenAccount: PublicKey
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        amount: amount.toString(),
        programId: this.programId.toString(),
      },
      'Building provide_liquidity instruction for lockrelease'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'provide_liquidity');

    const accounts = LockreleaseTokenPoolAccounts.provideLiquidity(
      this.programId,
      mint,
      authority,
      tokenProgram,
      userTokenAccount
    ).build();

    // Encode amount as u64
    const data = Buffer.allocUnsafe(8);
    data.writeBigUInt64LE(amount, 0);

    const instruction = AnchorUtils.buildInstruction(
      'provide_liquidity',
      this.programId,
      accounts,
      data
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated lockrelease provide_liquidity instruction'
    );

    return instruction;
  }

  /**
   * Withdraw liquidity from the pool
   */
  async withdrawLiquidity(
    mint: PublicKey,
    authority: PublicKey,
    amount: bigint,
    tokenProgram: PublicKey,
    userTokenAccount: PublicKey
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        amount: amount.toString(),
        programId: this.programId.toString(),
      },
      'Building withdraw_liquidity instruction for lockrelease'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'withdraw_liquidity');

    const accounts = LockreleaseTokenPoolAccounts.withdrawLiquidity(
      this.programId,
      mint,
      authority,
      tokenProgram,
      userTokenAccount
    ).build();

    // Encode amount as u64
    const data = Buffer.allocUnsafe(8);
    data.writeBigUInt64LE(amount, 0);

    const instruction = AnchorUtils.buildInstruction(
      'withdraw_liquidity',
      this.programId,
      accounts,
      data
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated lockrelease withdraw_liquidity instruction'
    );

    return instruction;
  }

  /**
   * Set whether the pool can accept liquidity
   */
  async setCanAcceptLiquidity(
    mint: PublicKey,
    authority: PublicKey,
    canAccept: boolean
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        canAccept,
        programId: this.programId.toString(),
      },
      'Building set_can_accept_liquidity instruction for lockrelease'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'set_can_accept_liquidity');

    const accounts = LockreleaseTokenPoolAccounts.setCanAcceptLiquidity(
      this.programId,
      mint,
      authority
    ).build();

    // Encode boolean as single byte
    const data = Buffer.from([canAccept ? 1 : 0]);

    const instruction = AnchorUtils.buildInstruction(
      'set_can_accept_liquidity',
      this.programId,
      accounts,
      data
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated lockrelease set_can_accept_liquidity instruction'
    );

    return instruction;
  }

  /**
   * Set the rebalancer for the pool
   */
  async setRebalancer(
    mint: PublicKey,
    authority: PublicKey,
    rebalancer: PublicKey
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        mint: mint.toString(),
        authority: authority.toString(),
        rebalancer: rebalancer.toString(),
        programId: this.programId.toString(),
      },
      'Building set_rebalancer instruction for lockrelease'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'set_rebalancer');

    const accounts = LockreleaseTokenPoolAccounts.setRebalancer(
      this.programId,
      mint,
      authority
    ).build();

    // Encode rebalancer address as data
    const data = rebalancer.toBuffer();

    const instruction = AnchorUtils.buildInstruction(
      'set_rebalancer',
      this.programId,
      accounts,
      data
    );

    logger.debug(
      {
        instructionDataLength: instruction.data.length,
        discriminator: Array.from(instruction.data.subarray(0, 8)),
      },
      'Generated lockrelease set_rebalancer instruction'
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
      'Building init_chain_remote_config instruction for lockrelease'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'init_chain_remote_config');

    const accounts = LockreleaseTokenPoolAccounts.initChainRemoteConfig(
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
      'Generated lockrelease init_chain_remote_config instruction'
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
      'Building edit_chain_remote_config instruction for lockrelease'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'edit_chain_remote_config');

    const accounts = LockreleaseTokenPoolAccounts.editChainRemoteConfig(
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
      'Generated lockrelease edit_chain_remote_config instruction'
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
      'Building append_remote_pool_addresses instruction for lockrelease'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'append_remote_pool_addresses');

    const accounts = LockreleaseTokenPoolAccounts.appendRemotePoolAddresses(
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
      'Generated lockrelease append_remote_pool_addresses instruction'
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
      'Building set_chain_rate_limit instruction for lockrelease'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'set_chain_rate_limit');

    const accounts = LockreleaseTokenPoolAccounts.setChainRateLimit(
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
    // Complete instruction data layout (74 bytes total):
    // Bytes 0-7:    Chain selector as u64 LE                   // remoteChainSelector
    // Bytes 8-39:   Token mint as PublicKey                    // mint
    // Bytes 40:     Inbound enabled (bool)                     // 1 byte
    // Bytes 41-48:  Inbound capacity as u64 LE                 // 8 bytes
    // Bytes 49-56:  Inbound rate as u64 LE                     // 8 bytes
    // Bytes 57:     Outbound enabled (bool)                    // 1 byte
    // Bytes 58-65:  Outbound capacity as u64 LE                // 8 bytes
    // Bytes 66-73:  Outbound rate as u64 LE                    // 8 bytes

    // Allocate buffer for instruction data (74 bytes)
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
      'Generated lockrelease set_chain_rate_limit instruction'
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
      'Building delete_chain_config instruction for lockrelease'
    );

    AnchorUtils.validateInstructionExists(this.idl, 'delete_chain_config');

    const accounts = LockreleaseTokenPoolAccounts.deleteChainConfig(
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
      'Generated lockrelease delete_chain_config instruction'
    );

    return instruction;
  }
}
