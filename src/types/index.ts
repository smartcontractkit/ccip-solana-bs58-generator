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

export const SetChainRateLimitArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  remoteChainSelector: z.string().transform(val => {
    const num = BigInt(val);
    if (num < 0) throw new Error('Remote chain selector must be non-negative');
    return num;
  }),
  inboundEnabled: z.string().transform(val => {
    if (val.toLowerCase() === 'true') return true;
    if (val.toLowerCase() === 'false') return false;
    throw new Error('inboundEnabled must be "true" or "false"');
  }),
  inboundCapacity: z.string().transform(val => {
    const num = BigInt(val);
    if (num < 0) throw new Error('Inbound capacity must be non-negative');
    return num;
  }),
  inboundRate: z.string().transform(val => {
    const num = BigInt(val);
    if (num < 0) throw new Error('Inbound rate must be non-negative');
    return num;
  }),
  outboundEnabled: z.string().transform(val => {
    if (val.toLowerCase() === 'true') return true;
    if (val.toLowerCase() === 'false') return false;
    throw new Error('outboundEnabled must be "true" or "false"');
  }),
  outboundCapacity: z.string().transform(val => {
    const num = BigInt(val);
    if (num < 0) throw new Error('Outbound capacity must be non-negative');
    return num;
  }),
  outboundRate: z.string().transform(val => {
    const num = BigInt(val);
    if (num < 0) throw new Error('Outbound rate must be non-negative');
    return num;
  }),
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
