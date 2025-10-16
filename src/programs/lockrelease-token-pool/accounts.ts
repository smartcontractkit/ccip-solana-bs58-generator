import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { LOCKRELEASE_TOKEN_POOL, PROGRAM_IDS } from '../../utils/constants.js';
import { AccountBuilder } from '../../utils/accounts.js';

/**
 * Account derivation utilities for lockrelease_token_pool instructions
 */
export class AccountDerivation {
  /**
   * Derive the state PDA for a given mint
   * @param programId The lockrelease_token_pool program ID
   * @param mint The mint public key
   * @returns State PDA and bump seed
   */
  static deriveStatePda(programId: PublicKey, mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(LOCKRELEASE_TOKEN_POOL.STATE_SEED), mint.toBuffer()],
      programId
    );
  }

  /**
   * Derive the chain config PDA for a given mint and remote chain selector
   * @param programId The lockrelease_token_pool program ID
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
      [Buffer.from(LOCKRELEASE_TOKEN_POOL.CHAIN_CONFIG_SEED), chainSelectorBuffer, mint.toBuffer()],
      programId
    );
  }

  /**
   * Derive the pool signer PDA for a given mint
   * @param programId The lockrelease_token_pool program ID
   * @param mint The mint public key
   * @returns Pool signer PDA and bump seed
   */
  static derivePoolSignerPda(programId: PublicKey, mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(LOCKRELEASE_TOKEN_POOL.POOL_SIGNER_SEED), mint.toBuffer()],
      programId
    );
  }

  /**
   * Derive the pool token account using Associated Token Account (ATA) derivation
   * This matches the Rust implementation: get_associated_token_address_with_program_id(&pool_signer, &mint, &token_program)
   * @param programId The lockrelease_token_pool program ID
   * @param mint The mint public key
   * @param tokenProgram The token program ID (TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID)
   * @returns Pool token account address (ATA)
   */
  static derivePoolTokenAccount(
    programId: PublicKey,
    mint: PublicKey,
    tokenProgram: PublicKey
  ): PublicKey {
    const [poolSignerPda] = AccountDerivation.derivePoolSignerPda(programId, mint);
    // Use proper SPL ATA derivation to match Rust get_associated_token_address_with_program_id
    return getAssociatedTokenAddressSync(
      mint,
      poolSignerPda,
      true, // allowOwnerOffCurve
      tokenProgram
    );
  }

  /**
   * Derive the global config PDA for the lockrelease token pool program
   * seeds = [b"config"]
   */
  static deriveGlobalConfigPda(programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(LOCKRELEASE_TOKEN_POOL.CONFIG_SEED)],
      programId
    );
  }

  /**
   * Derive the Program Data PDA for an upgradeable program
   * seeds = [programId]
   */
  static deriveProgramDataPda(programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [programId.toBuffer()],
      PROGRAM_IDS.BPF_LOADER_UPGRADEABLE_PROGRAM_ID
    );
  }
}

/**
 * Account builder for lockrelease token pool instructions
 */
export class LockreleaseTokenPoolAccounts {
  /**
   * Build accounts for initialize (pool state) instruction
   */
  static initialize(programId: PublicKey, mint: PublicKey, authority: PublicKey): AccountBuilder {
    const [statePda] = AccountDerivation.deriveStatePda(programId, mint);
    const [programDataPda] = AccountDerivation.deriveProgramDataPda(programId);
    const [globalConfigPda] = AccountDerivation.deriveGlobalConfigPda(programId);

    return new AccountBuilder()
      .addWritable(statePda)
      .addReadOnly(mint)
      .addSigner(authority, true)
      .addReadOnly(SystemProgram.programId)
      .addReadOnly(programId)
      .addReadOnly(programDataPda)
      .addReadOnly(globalConfigPda);
  }

  /**
   * Build accounts for acceptOwnership instruction
   * @param programId The lockrelease_token_pool program ID
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
   * @param programId The lockrelease_token_pool program ID
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
   * Build accounts for setRateLimitAdmin instruction
   * @param programId The lockrelease_token_pool program ID
   * @param mint The mint public key
   * @param authority The current authority public key
   * @returns Account builder with required accounts
   */
  static setRateLimitAdmin(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey
  ): AccountBuilder {
    const [statePda] = AccountDerivation.deriveStatePda(programId, mint);

    return new AccountBuilder()
      .addWritable(statePda) // state account (writable)
      .addSigner(authority, true); // authority account (writable, signer)
  }

  /**
   * Build accounts for configureAllowList instruction
   * @param programId The lockrelease_token_pool program ID
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
   * @param programId The lockrelease_token_pool program ID
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

  // Lockrelease-specific account builders

  /**
   * Build accounts for provideLiquidity instruction
   * @param programId The lockrelease_token_pool program ID
   * @param mint The mint public key
   * @param authority The authority public key
   * @param tokenProgram The token program ID
   * @param userTokenAccount The user's token account (remote_token_account)
   * @returns Account builder with required accounts
   */
  static provideLiquidity(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey,
    tokenProgram: PublicKey,
    userTokenAccount: PublicKey
  ): AccountBuilder {
    const [statePda] = AccountDerivation.deriveStatePda(programId, mint);
    const [poolSignerPda] = AccountDerivation.derivePoolSignerPda(programId, mint);
    const poolTokenAccount = AccountDerivation.derivePoolTokenAccount(
      programId,
      mint,
      tokenProgram
    );

    return new AccountBuilder()
      .addReadOnly(statePda) // state account (read-only)
      .addReadOnly(tokenProgram) // token program
      .addWritable(mint) // mint account (writable)
      .addReadOnly(poolSignerPda) // pool signer
      .addWritable(poolTokenAccount) // pool token account (writable)
      .addWritable(userTokenAccount) // remote token account (writable) - user's token account
      .addSigner(authority); // authority (signer)
  }

  /**
   * Build accounts for withdrawLiquidity instruction
   * @param programId The lockrelease_token_pool program ID
   * @param mint The mint public key
   * @param authority The authority public key
   * @param tokenProgram The token program ID
   * @param userTokenAccount The user's token account (remote_token_account)
   * @returns Account builder with required accounts
   */
  static withdrawLiquidity(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey,
    tokenProgram: PublicKey,
    userTokenAccount: PublicKey
  ): AccountBuilder {
    const [statePda] = AccountDerivation.deriveStatePda(programId, mint);
    const [poolSignerPda] = AccountDerivation.derivePoolSignerPda(programId, mint);
    const poolTokenAccount = AccountDerivation.derivePoolTokenAccount(
      programId,
      mint,
      tokenProgram
    );

    return new AccountBuilder()
      .addReadOnly(statePda) // state account (read-only)
      .addReadOnly(tokenProgram) // token program
      .addWritable(mint) // mint account (writable)
      .addReadOnly(poolSignerPda) // pool signer
      .addWritable(poolTokenAccount) // pool token account (writable)
      .addWritable(userTokenAccount) // remote token account (writable) - user's token account
      .addSigner(authority); // authority (signer)
  }

  /**
   * Build accounts for setCanAcceptLiquidity instruction
   * @param programId The lockrelease_token_pool program ID
   * @param mint The mint public key
   * @param authority The authority public key
   * @returns Account builder with required accounts
   */
  static setCanAcceptLiquidity(
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
   * Build accounts for setRebalancer instruction
   * @param programId The lockrelease_token_pool program ID
   * @param mint The mint public key
   * @param authority The authority public key
   * @returns Account builder with required accounts
   */
  static setRebalancer(
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
   * Build accounts for initChainRemoteConfig instruction
   * @param programId The lockrelease_token_pool program ID
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
   * @param programId The lockrelease_token_pool program ID
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
   * @param programId The lockrelease_token_pool program ID
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
   * Build accounts for setChainRateLimit instruction
   * @param programId The lockrelease_token_pool program ID
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
   * Build accounts for deleteChainConfig instruction
   * @param programId The lockrelease_token_pool program ID
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
}
