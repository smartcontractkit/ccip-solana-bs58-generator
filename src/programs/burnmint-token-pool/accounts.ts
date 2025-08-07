import { PublicKey } from '@solana/web3.js';
import { BURNMINT_TOKEN_POOL } from '../../utils/constants.js';
import { AccountBuilder } from '../../utils/accounts.js';

/**
 * Account derivation utilities for burnmint_token_pool acceptOwnership instruction
 */
export class AccountDerivation {
  /**
   * Derive the state PDA for a given mint
   * @param programId The burnmint_token_pool program ID
   * @param mint The mint public key
   * @returns State PDA and bump seed
   */
  static deriveStatePda(programId: PublicKey, mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(BURNMINT_TOKEN_POOL.STATE_SEED), mint.toBuffer()],
      programId
    );
  }
}

/**
 * Account builder for acceptOwnership instruction
 */
export class BurnmintTokenPoolAccounts {
  /**
   * Build accounts for acceptOwnership instruction
   * @param programId The burnmint_token_pool program ID
   * @param mint The mint public key
   * @param authority The new authority public key
   * @returns Account builder with required accounts
   */
  static acceptOwnership(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey
  ): AccountBuilder {
    const [statePda] = AccountDerivation.deriveStatePda(programId, mint);

    return new AccountBuilder()
      .addWritable(statePda) // state account (writable)
      .addReadOnly(mint) // mint account (read-only)
      .addSigner(authority); // authority account (signer)
  }
}
