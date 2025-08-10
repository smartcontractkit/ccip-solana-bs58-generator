import { PublicKey, SystemProgram } from '@solana/web3.js';
import { BURNMINT_TOKEN_POOL } from '../../utils/constants.js';
import { AccountBuilder } from '../../utils/accounts.js';

/**
 * Account derivation utilities for burnmint_token_pool instructions
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

  /**
   * Derive the chain config PDA for a given mint and remote chain selector
   * @param programId The burnmint_token_pool program ID
   * @param mint The mint public key
   * @param remoteChainSelector The remote chain selector
   * @returns Chain config PDA and bump seed
   */
  static deriveChainConfigPda(
    programId: PublicKey,
    mint: PublicKey,
    remoteChainSelector: bigint
  ): [PublicKey, number] {
    // Convert bigint to 8-byte buffer (little-endian)
    const chainSelectorBuffer = Buffer.alloc(8);
    chainSelectorBuffer.writeBigUInt64LE(remoteChainSelector);

    return PublicKey.findProgramAddressSync(
      [Buffer.from(BURNMINT_TOKEN_POOL.CHAIN_CONFIG_SEED), chainSelectorBuffer, mint.toBuffer()],
      programId
    );
  }

  /**
   * Derive the pool signer PDA for a given mint
   * @param programId The burnmint_token_pool program ID
   * @param mint The mint public key
   * @returns Pool signer PDA and bump seed
   */
  static derivePoolSignerPda(programId: PublicKey, mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(BURNMINT_TOKEN_POOL.POOL_SIGNER_SEED), mint.toBuffer()],
      programId
    );
  }
}

/**
 * Account builder for burnmint token pool instructions
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

  /**
   * Build accounts for transferOwnership instruction
   * @param programId The burnmint_token_pool program ID
   * @param mint The mint public key
   * @param authority The current authority public key
   * @returns Account builder with required accounts
   */
  static transferOwnership(
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

  /**
   * Build accounts for setChainRateLimit instruction
   * @param programId The burnmint_token_pool program ID
   * @param mint The mint public key
   * @param authority The authority public key
   * @param remoteChainSelector The remote chain selector
   * @returns Account builder with required accounts
   */
  static setChainRateLimit(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey,
    remoteChainSelector: bigint
  ): AccountBuilder {
    const [statePda] = AccountDerivation.deriveStatePda(programId, mint);
    const [chainConfigPda] = AccountDerivation.deriveChainConfigPda(
      programId,
      mint,
      remoteChainSelector
    );

    return new AccountBuilder()
      .addReadOnly(statePda) // state account (read-only)
      .addWritable(chainConfigPda) // chain config account (writable)
      .addSigner(authority, true); // authority account (writable, signer)
  }

  /**
   * Build accounts for initChainRemoteConfig instruction
   * @param programId The burnmint_token_pool program ID
   * @param mint The mint public key
   * @param authority The authority public key
   * @param remoteChainSelector The remote chain selector
   * @returns Account builder with required accounts
   */
  static initChainRemoteConfig(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey,
    remoteChainSelector: bigint
  ): AccountBuilder {
    const [statePda] = AccountDerivation.deriveStatePda(programId, mint);
    const [chainConfigPda] = AccountDerivation.deriveChainConfigPda(
      programId,
      mint,
      remoteChainSelector
    );

    return new AccountBuilder()
      .addReadOnly(statePda) // state account (read-only)
      .addWritable(chainConfigPda) // chain config account (writable)
      .addSigner(authority, true) // authority account (writable, signer)
      .addReadOnly(SystemProgram.programId); // system program
  }

  /**
   * Build accounts for editChainRemoteConfig instruction
   * @param programId The burnmint_token_pool program ID
   * @param mint The mint public key
   * @param authority The authority public key
   * @param remoteChainSelector The remote chain selector
   * @returns Account builder with required accounts
   */
  static editChainRemoteConfig(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey,
    remoteChainSelector: bigint
  ): AccountBuilder {
    const [statePda] = AccountDerivation.deriveStatePda(programId, mint);
    const [chainConfigPda] = AccountDerivation.deriveChainConfigPda(
      programId,
      mint,
      remoteChainSelector
    );

    return new AccountBuilder()
      .addReadOnly(statePda) // state account (read-only)
      .addWritable(chainConfigPda) // chain config account (writable)
      .addSigner(authority, true) // authority account (writable, signer)
      .addReadOnly(SystemProgram.programId); // system program
  }

  /**
   * Build accounts for appendRemotePoolAddresses instruction
   * @param programId The burnmint_token_pool program ID
   * @param mint The mint public key
   * @param authority The authority public key
   * @param remoteChainSelector The remote chain selector
   * @returns Account builder with required accounts
   */
  static appendRemotePoolAddresses(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey,
    remoteChainSelector: bigint
  ): AccountBuilder {
    const [statePda] = AccountDerivation.deriveStatePda(programId, mint);
    const [chainConfigPda] = AccountDerivation.deriveChainConfigPda(
      programId,
      mint,
      remoteChainSelector
    );

    return new AccountBuilder()
      .addReadOnly(statePda) // state account (read-only)
      .addWritable(chainConfigPda) // chain config account (writable)
      .addSigner(authority, true) // authority account (writable, signer)
      .addReadOnly(SystemProgram.programId); // system program
  }

  /**
   * Build accounts for deleteChainConfig instruction
   * @param programId The burnmint_token_pool program ID
   * @param mint The mint public key
   * @param authority The authority public key
   * @param remoteChainSelector The remote chain selector
   * @returns Account builder with required accounts
   */
  static deleteChainConfig(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey,
    remoteChainSelector: bigint
  ): AccountBuilder {
    const [statePda] = AccountDerivation.deriveStatePda(programId, mint);
    const [chainConfigPda] = AccountDerivation.deriveChainConfigPda(
      programId,
      mint,
      remoteChainSelector
    );

    return new AccountBuilder()
      .addReadOnly(statePda) // state account (read-only)
      .addWritable(chainConfigPda) // chain config account (writable)
      .addSigner(authority, true); // authority account (writable, signer)
  }

  /**
   * Build accounts for configureAllowList instruction
   * @param programId The burnmint_token_pool program ID
   * @param mint The mint public key
   * @param authority The authority public key
   * @returns Account builder with required accounts
   */
  static configureAllowList(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey
  ): AccountBuilder {
    const [statePda] = AccountDerivation.deriveStatePda(programId, mint);

    return new AccountBuilder()
      .addWritable(statePda) // state account (writable)
      .addReadOnly(mint) // mint account (read-only)
      .addSigner(authority, true) // authority account (writable, signer)
      .addReadOnly(SystemProgram.programId); // system program
  }

  /**
   * Build accounts for removeFromAllowList instruction
   * @param programId The burnmint_token_pool program ID
   * @param mint The mint public key
   * @param authority The authority public key
   * @returns Account builder with required accounts
   */
  static removeFromAllowList(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey
  ): AccountBuilder {
    const [statePda] = AccountDerivation.deriveStatePda(programId, mint);

    return new AccountBuilder()
      .addWritable(statePda) // state account (writable)
      .addReadOnly(mint) // mint account (read-only)
      .addSigner(authority, true) // authority account (writable, signer)
      .addReadOnly(SystemProgram.programId); // system program
  }
}
