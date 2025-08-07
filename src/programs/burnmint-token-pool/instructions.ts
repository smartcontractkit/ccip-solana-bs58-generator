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
}
