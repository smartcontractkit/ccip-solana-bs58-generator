import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { AnchorUtils } from '../../utils/anchor.js';
import { RouterAccounts } from './accounts.js';
import type { Idl } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Instruction builder for ccip_router program using Anchor-style encoding
 */
export class InstructionBuilder {
  private programId: PublicKey;
  private idl: Idl;

  constructor(programId: PublicKey, idl: Idl) {
    this.programId = programId;
    this.idl = idl;
  }

  async ownerProposeAdministrator(
    mint: PublicKey,
    authority: PublicKey,
    tokenAdminRegistryAdmin: PublicKey
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        programId: this.programId.toString(),
        mint: mint.toString(),
        authority: authority.toString(),
        tokenAdminRegistryAdmin: tokenAdminRegistryAdmin.toString(),
      },
      'Building owner_propose_administrator instruction with Anchor'
    );
    AnchorUtils.validateInstructionExists(this.idl, 'owner_propose_administrator');

    const accounts = RouterAccounts.ownerProposeAdministrator(
      this.programId,
      mint,
      authority
    ).build();

    // Args: token_admin_registry_admin (Pubkey)
    const data = tokenAdminRegistryAdmin.toBuffer();

    const instruction = AnchorUtils.buildInstruction(
      'owner_propose_administrator',
      this.programId,
      accounts,
      data
    );

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

  async ownerOverridePendingAdministrator(
    mint: PublicKey,
    authority: PublicKey,
    tokenAdminRegistryAdmin: PublicKey
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        programId: this.programId.toString(),
        mint: mint.toString(),
        authority: authority.toString(),
        tokenAdminRegistryAdmin: tokenAdminRegistryAdmin.toString(),
      },
      'Building owner_override_pending_administrator instruction with Anchor'
    );
    AnchorUtils.validateInstructionExists(this.idl, 'owner_override_pending_administrator');

    const accounts = RouterAccounts.ownerOverridePendingAdministrator(
      this.programId,
      mint,
      authority
    ).build();

    const data = tokenAdminRegistryAdmin.toBuffer();

    const instruction = AnchorUtils.buildInstruction(
      'owner_override_pending_administrator',
      this.programId,
      accounts,
      data
    );
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

  async acceptAdminRoleTokenAdminRegistry(
    mint: PublicKey,
    authority: PublicKey
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        programId: this.programId.toString(),
        mint: mint.toString(),
        authority: authority.toString(),
      },
      'Building accept_admin_role_token_admin_registry instruction with Anchor'
    );
    AnchorUtils.validateInstructionExists(this.idl, 'accept_admin_role_token_admin_registry');

    const accounts = RouterAccounts.acceptAdminRoleTokenAdminRegistry(
      this.programId,
      mint,
      authority
    ).build();

    const instruction = AnchorUtils.buildInstruction(
      'accept_admin_role_token_admin_registry',
      this.programId,
      accounts
    );
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

  async transferAdminRoleTokenAdminRegistry(
    mint: PublicKey,
    authority: PublicKey,
    newAdmin: PublicKey
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        programId: this.programId.toString(),
        mint: mint.toString(),
        authority: authority.toString(),
        newAdmin: newAdmin.toString(),
      },
      'Building transfer_admin_role_token_admin_registry instruction with Anchor'
    );
    AnchorUtils.validateInstructionExists(this.idl, 'transfer_admin_role_token_admin_registry');

    const accounts = RouterAccounts.transferAdminRoleTokenAdminRegistry(
      this.programId,
      mint,
      authority
    ).build();

    const data = newAdmin.toBuffer();

    const instruction = AnchorUtils.buildInstruction(
      'transfer_admin_role_token_admin_registry',
      this.programId,
      accounts,
      data
    );
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

  async setPool(
    mint: PublicKey,
    poolLookupTable: PublicKey,
    authority: PublicKey,
    writableIndexes: number[]
  ): Promise<TransactionInstruction> {
    logger.debug(
      {
        programId: this.programId.toString(),
        mint: mint.toString(),
        poolLookupTable: poolLookupTable.toString(),
        authority: authority.toString(),
        writableIndexesCount: writableIndexes.length,
        writableIndexes,
      },
      'Building set_pool instruction with Anchor'
    );
    AnchorUtils.validateInstructionExists(this.idl, 'set_pool');

    const accounts = RouterAccounts.setPool(
      this.programId,
      mint,
      poolLookupTable,
      authority
    ).build();

    // Args: writable_indexes (Vec<u8>) -> borsh: u32 LE length + bytes
    const indicesArray = Uint8Array.from(writableIndexes);
    const len = Buffer.alloc(4);
    len.writeUInt32LE(indicesArray.length, 0);
    const data = Buffer.concat([len, Buffer.from(indicesArray)]);

    const instruction = AnchorUtils.buildInstruction('set_pool', this.programId, accounts, data);
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
}
