import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { BurnmintTokenPoolAccounts } from './accounts.js';
import { logger } from '../../utils/logger.js';
import { AnchorUtils } from '../../utils/anchor.js';
import type { Idl } from '../../types/index.js';

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
}
