import { PublicKey } from '@solana/web3.js';
import { z } from 'zod';
export type { Idl } from '@coral-xyz/anchor';

// CLI command argument schemas (before validation)
export const AcceptOwnershipArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  rpcUrl: z
    .string()
    .refine(
      val => {
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Invalid URL format' }
    )
    .optional(),
});

// Simple options for transaction building and simulation (no execution)
export interface TransactionOptions {
  rpcUrl: string;
}

// Generated transaction output
export interface GeneratedTransaction {
  instruction: string; // Instruction name
  base58: string; // BS58 encoded transaction
  hex: string; // Hex encoded transaction
  accounts: {
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  details: {
    programId: string;
    instructionData: string;
    signers: string[];
    writableAccounts: string[];
    readOnlyAccounts: string[];
    feePayer: string;
    accountSummary: {
      total: number;
      signers: number;
      writable: number;
      readOnly: number;
    };
  };
  metadata: {
    generatedAt: string;
    computeUnits?: number;
  };
}

// Logger configuration
export interface LoggerConfig {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  pretty?: boolean;
  destination?: string;
}
