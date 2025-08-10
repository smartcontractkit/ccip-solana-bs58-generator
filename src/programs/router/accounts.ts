import { PublicKey, SystemProgram } from '@solana/web3.js';
import { ROUTER_SEEDS } from '../../utils/constants.js';
import { AccountBuilder } from '../../utils/accounts.js';

/**
 * Account builder utilities for ccip_router instructions
 *
 */
export class AccountDerivation {
  /**
   * Derive the router config PDA
   * seeds = [b"config"]
   */
  static deriveConfigPda(programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from(ROUTER_SEEDS.CONFIG)], programId);
  }

  /**
   * Derive the token admin registry PDA for a given mint
   * seeds = [b"token_admin_registry", mint]
   */
  static deriveTokenAdminRegistryPda(programId: PublicKey, mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(ROUTER_SEEDS.TOKEN_ADMIN_REGISTRY), mint.toBuffer()],
      programId
    );
  }

  /**
   * Derive the router external token pools signer PDA
   * seeds = [b"external_token_pools_signer", poolProgramId]
   */
  static deriveExternalTokenPoolsSignerPda(
    programId: PublicKey,
    poolProgramId: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(ROUTER_SEEDS.EXTERNAL_TOKEN_POOLS_SIGNER), poolProgramId.toBuffer()],
      programId
    );
  }
}

export class RouterAccounts {
  /**
   * Accounts for owner_propose_administrator
   */
  static ownerProposeAdministrator(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey
  ): AccountBuilder {
    const [config] = AccountDerivation.deriveConfigPda(programId);
    const [tokenAdminRegistry] = AccountDerivation.deriveTokenAdminRegistryPda(programId, mint);
    return new AccountBuilder()
      .addReadOnly(config)
      .addWritable(tokenAdminRegistry)
      .addReadOnly(mint)
      .addSigner(authority, true) // signer, writable
      .addReadOnly(SystemProgram.programId); // system program
  }

  /**
   * Accounts for owner_override_pending_administrator
   */
  static ownerOverridePendingAdministrator(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey
  ): AccountBuilder {
    const [config] = AccountDerivation.deriveConfigPda(programId);
    const [tokenAdminRegistry] = AccountDerivation.deriveTokenAdminRegistryPda(programId, mint);
    return new AccountBuilder()
      .addReadOnly(config)
      .addWritable(tokenAdminRegistry)
      .addReadOnly(mint)
      .addSigner(authority, true)
      .addReadOnly(SystemProgram.programId);
  }

  /**
   * Accounts for accept_admin_role_token_admin_registry
   */
  static acceptAdminRoleTokenAdminRegistry(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey
  ): AccountBuilder {
    const [config] = AccountDerivation.deriveConfigPda(programId);
    const [tokenAdminRegistry] = AccountDerivation.deriveTokenAdminRegistryPda(programId, mint);
    return new AccountBuilder()
      .addReadOnly(config)
      .addWritable(tokenAdminRegistry)
      .addReadOnly(mint)
      .addSigner(authority, true);
  }

  /**
   * Accounts for transfer_admin_role_token_admin_registry
   */
  static transferAdminRoleTokenAdminRegistry(
    programId: PublicKey,
    mint: PublicKey,
    authority: PublicKey
  ): AccountBuilder {
    const [config] = AccountDerivation.deriveConfigPda(programId);
    const [tokenAdminRegistry] = AccountDerivation.deriveTokenAdminRegistryPda(programId, mint);
    return new AccountBuilder()
      .addReadOnly(config)
      .addWritable(tokenAdminRegistry)
      .addReadOnly(mint)
      .addSigner(authority, true);
  }

  /**
   * Accounts for set_pool
   */
  static setPool(
    programId: PublicKey,
    mint: PublicKey,
    poolLookupTable: PublicKey,
    authority: PublicKey
  ): AccountBuilder {
    const [config] = AccountDerivation.deriveConfigPda(programId);
    const [tokenAdminRegistry] = AccountDerivation.deriveTokenAdminRegistryPda(programId, mint);
    return new AccountBuilder()
      .addReadOnly(config)
      .addWritable(tokenAdminRegistry)
      .addReadOnly(mint)
      .addReadOnly(poolLookupTable)
      .addSigner(authority, true);
  }
}
