import { PublicKey, TransactionInstruction, Connection } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { BurnmintTokenPoolAccounts } from './accounts.js';
import { logger } from '../../utils/logger.js';
import type { Idl } from '../../types/index.js';

/**
 * Instruction builder for burnmint_token_pool program using Anchor
 */
export class InstructionBuilder {
  private programId: PublicKey;
  private idl: Idl;
  private rpcUrl: string;

  constructor(programId: PublicKey, idl: Idl, rpcUrl: string) {
    this.programId = programId;
    this.idl = idl;
    this.rpcUrl = rpcUrl;
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

    // Create connection for instruction building (no execution)
    const connection = new Connection(this.rpcUrl);

    // Create program instance without wallet - perfect for instruction building
    const program = new Program(this.idl, { connection });

    // Derive accounts using our existing logic
    const accounts = BurnmintTokenPoolAccounts.acceptOwnership(
      this.programId,
      mint,
      authority
    ).build();

    const [stateAccount, mintAccount, authorityAccount] = accounts;

    // Ensure all accounts are defined
    if (!stateAccount || !mintAccount || !authorityAccount) {
      throw new Error('One or more required accounts are undefined');
    }

    // Build instruction using Anchor (real discriminators!)
    if (!program.methods) {
      throw new Error('Program methods are not available');
    }

    if (!program.methods.acceptOwnership) {
      throw new Error('acceptOwnership method not found in program');
    }

    const instruction = await program.methods
      .acceptOwnership()
      .accounts({
        state: stateAccount.pubkey,
        mint: mintAccount.pubkey,
        authority: authorityAccount.pubkey,
      })
      .instruction();

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
