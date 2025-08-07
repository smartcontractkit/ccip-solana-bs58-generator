import { PublicKey } from '@solana/web3.js';

/**
 * Generic account builder for creating account metas for instructions
 * This utility can be used by all Solana programs (burnmint, lockrelease, router, spl-token, etc.)
 */
export class AccountBuilder {
  private accounts: {
    pubkey: PublicKey;
    isSigner: boolean;
    isWritable: boolean;
  }[] = [];

  /**
   * Add an account to the instruction
   * @param pubkey Account public key
   * @param isSigner Whether the account must sign
   * @param isWritable Whether the account is writable
   * @returns The account builder for chaining
   */
  add(pubkey: PublicKey, isSigner: boolean = false, isWritable: boolean = false): this {
    this.accounts.push({ pubkey, isSigner, isWritable });
    return this;
  }

  /**
   * Add a signer account
   * @param pubkey Account public key
   * @param isWritable Whether the account is writable
   * @returns The account builder for chaining
   */
  addSigner(pubkey: PublicKey, isWritable: boolean = false): this {
    return this.add(pubkey, true, isWritable);
  }

  /**
   * Add a writable account
   * @param pubkey Account public key
   * @param isSigner Whether the account must sign
   * @returns The account builder for chaining
   */
  addWritable(pubkey: PublicKey, isSigner: boolean = false): this {
    return this.add(pubkey, isSigner, true);
  }

  /**
   * Add a read-only account
   * @param pubkey Account public key
   * @returns The account builder for chaining
   */
  addReadOnly(pubkey: PublicKey): this {
    return this.add(pubkey, false, false);
  }

  /**
   * Build the accounts array
   * @returns Array of account metas
   */
  build(): {
    pubkey: PublicKey;
    isSigner: boolean;
    isWritable: boolean;
  }[] {
    return [...this.accounts];
  }
}
