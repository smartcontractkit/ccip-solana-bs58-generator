import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import {
  createInitializeMultisigInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
} from '@solana/spl-token';
import { createUpdateAuthorityInstruction } from '@solana/spl-token-metadata';

/**
 * Instruction builder for SPL Token program
 */
export class InstructionBuilder {
  private tokenProgramId: PublicKey;

  constructor(tokenProgramId: PublicKey) {
    this.tokenProgramId = tokenProgramId;
  }

  /**
   * Build a mintTo instruction
   */
  mintTo(
    mint: PublicKey,
    destinationTokenAccount: PublicKey,
    mintAuthority: PublicKey,
    amount: bigint,
    multisigSignerPubkeys: PublicKey[] = []
  ): TransactionInstruction {
    return createMintToInstruction(
      mint,
      destinationTokenAccount,
      mintAuthority,
      amount,
      multisigSignerPubkeys,
      this.tokenProgramId
    );
  }

  /**
   * Build instructions to create and initialize an SPL multisig account deterministically
   */
  async createMultisigWithSeed(
    payer: PublicKey,
    base: PublicKey,
    seed: string,
    signerPubkeys: PublicKey[],
    threshold: number,
    space: number,
    lamports: number
  ): Promise<{ address: PublicKey; instructions: TransactionInstruction[] }> {
    const multisigAddress = await PublicKey.createWithSeed(base, seed, this.tokenProgramId);

    const createIx = SystemProgram.createAccountWithSeed({
      fromPubkey: payer,
      newAccountPubkey: multisigAddress,
      basePubkey: base,
      seed,
      lamports,
      space,
      programId: this.tokenProgramId,
    });

    const initIx = createInitializeMultisigInstruction(
      multisigAddress,
      signerPubkeys,
      threshold,
      this.tokenProgramId
    );

    return { address: multisigAddress, instructions: [createIx, initIx] };
  }

  /**
   * Build a setAuthority (MintTokens) instruction to transfer mint authority
   */
  transferMintAuthority(
    mint: PublicKey,
    currentAuthority: PublicKey,
    newMintAuthority: PublicKey,
    multisigSignerPubkeys: PublicKey[] = []
  ): TransactionInstruction {
    return createSetAuthorityInstruction(
      mint,
      currentAuthority,
      AuthorityType.MintTokens,
      newMintAuthority,
      multisigSignerPubkeys,
      this.tokenProgramId
    );
  }

  /**
   * Build a Token-2022 update authority instruction for metadata (requires Token-2022)
   * If a separate metadata account is used via Metadata Pointer extension, pass it as metadataAccount.
   */
  updateMetadataAuthority(
    metadataAccount: PublicKey,
    oldAuthority: PublicKey,
    newAuthority: PublicKey | null
  ): TransactionInstruction {
    return createUpdateAuthorityInstruction({
      programId: this.tokenProgramId,
      metadata: metadataAccount,
      oldAuthority,
      newAuthority: newAuthority ?? null,
    });
  }
}
