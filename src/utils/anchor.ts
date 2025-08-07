import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { Idl } from '@coral-xyz/anchor';
import { createHash } from 'crypto';
import { logger } from './logger.js';

/**
 * Utility functions for working with Anchor programs
 */
export class AnchorUtils {
  /**
   * Calculate Anchor instruction discriminator
   * @param instructionName The instruction name (e.g., "accept_ownership")
   * @returns 8-byte discriminator buffer
   */
  static calculateDiscriminator(instructionName: string): Buffer {
    // Anchor discriminator format: sha256("global:instruction_name")[0..8]
    const discriminatorHash = createHash('sha256').update(`global:${instructionName}`).digest();

    const discriminator = discriminatorHash.subarray(0, 8);

    logger.debug(
      {
        instructionName,
        discriminatorHex: discriminator.toString('hex'),
        discriminatorArray: Array.from(discriminator),
      },
      'Calculated Anchor instruction discriminator'
    );

    return discriminator;
  }

  /**
   * Build a Solana instruction with Anchor-style discriminator
   * @param instructionName The instruction name (e.g., "acceptOwnership")
   * @param programId The program ID
   * @param accounts Array of account metas
   * @param data Additional instruction data (optional, appended after discriminator)
   * @returns TransactionInstruction
   */
  static buildInstruction(
    instructionName: string,
    programId: PublicKey,
    accounts: Array<{
      pubkey: PublicKey;
      isSigner: boolean;
      isWritable: boolean;
    }>,
    data?: Buffer
  ): TransactionInstruction {
    const discriminator = this.calculateDiscriminator(instructionName);

    // Combine discriminator with any additional data
    const instructionData = data ? Buffer.concat([discriminator, data]) : discriminator;

    const instruction = new TransactionInstruction({
      keys: accounts.map(account => ({
        pubkey: account.pubkey,
        isSigner: account.isSigner,
        isWritable: account.isWritable,
      })),
      programId,
      data: instructionData,
    });

    logger.debug(
      {
        instructionName,
        programId: programId.toString(),
        accountCount: accounts.length,
        dataLength: instructionData.length,
        discriminatorHex: discriminator.toString('hex'),
      },
      'Built Anchor instruction'
    );

    return instruction;
  }

  /**
   * Validate that an instruction exists in the IDL
   * @param idl The program IDL
   * @param instructionName The instruction name to validate
   * @throws Error if instruction not found
   */
  static validateInstructionExists(idl: Idl, instructionName: string): void {
    const instruction = idl.instructions?.find(ix => ix.name === instructionName);

    if (!instruction) {
      const availableInstructions = idl.instructions?.map(ix => ix.name) || [];
      throw new Error(
        `Instruction "${instructionName}" not found in IDL. Available instructions: ${availableInstructions.join(', ')}`
      );
    }

    logger.debug(
      {
        instructionName,
        found: true,
        totalInstructions: idl.instructions?.length || 0,
      },
      'Validated instruction exists in IDL'
    );
  }
}
