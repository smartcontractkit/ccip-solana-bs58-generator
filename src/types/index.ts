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

export const TransferOwnershipArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  proposedOwner: z.string().transform(val => new PublicKey(val)),
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

export const InitChainRemoteConfigArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  remoteChainSelector: z.string().transform(val => {
    const num = BigInt(val);
    if (num < 0) throw new Error('Remote chain selector must be non-negative');
    return num;
  }),
  poolAddresses: z.string().transform(val => {
    try {
      const addresses = JSON.parse(val);
      if (!Array.isArray(addresses)) throw new Error('Pool addresses must be an array');
      // Normalize: accept 0x-prefixed or hex; ensure strings
      return addresses.map((a: unknown) => {
        if (typeof a !== 'string') throw new Error('Pool address must be a string');
        return a;
      });
    } catch (e) {
      throw new Error(
        `Invalid JSON for pool addresses: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }),
  tokenAddress: z
    .string()
    .refine(
      v => /^(0x)?[0-9a-fA-F]+$/.test(v),
      'Token address must be hex (optionally 0x-prefixed)'
    )
    .transform(v => (v.startsWith('0x') ? v.slice(2) : v)),
  decimals: z.string().transform(val => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0 || num > 255) throw new Error('Decimals must be between 0 and 255');
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

export const EditChainRemoteConfigArgsSchema = InitChainRemoteConfigArgsSchema;

export const AppendRemotePoolAddressesArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  remoteChainSelector: z.string().transform(val => {
    const num = BigInt(val);
    if (num < 0) throw new Error('Remote chain selector must be non-negative');
    return num;
  }),
  addresses: z.string().transform(val => {
    try {
      const addresses = JSON.parse(val);
      if (!Array.isArray(addresses)) throw new Error('Addresses must be an array');
      return addresses.map((a: unknown) => {
        if (typeof a !== 'string') throw new Error('Address must be a string');
        return a;
      });
    } catch (e) {
      throw new Error(`Invalid JSON for addresses: ${e instanceof Error ? e.message : String(e)}`);
    }
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

export const DeleteChainConfigArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  remoteChainSelector: z.string().transform(val => {
    const num = BigInt(val);
    if (num < 0) throw new Error('Remote chain selector must be non-negative');
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

export const ConfigureAllowListArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  add: z.string().transform(val => {
    try {
      const addresses = JSON.parse(val);
      if (!Array.isArray(addresses)) throw new Error('Add must be an array');
      return addresses.map(addr => new PublicKey(addr));
    } catch (e) {
      throw new Error(
        `Invalid JSON for add addresses: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }),
  enabled: z.string().transform(val => {
    if (val.toLowerCase() === 'true') return true;
    if (val.toLowerCase() === 'false') return false;
    throw new Error('enabled must be "true" or "false"');
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

export const RemoveFromAllowListArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  remove: z.string().transform(val => {
    try {
      const addresses = JSON.parse(val);
      if (!Array.isArray(addresses)) throw new Error('Remove must be an array');
      return addresses.map(addr => new PublicKey(addr));
    } catch (e) {
      throw new Error(
        `Invalid JSON for remove addresses: ${e instanceof Error ? e.message : String(e)}`
      );
    }
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

// Router CLI argument schemas
export const RouterOwnerProposeAdministratorArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  tokenAdminRegistryAdmin: z.string().transform(val => new PublicKey(val)),
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

export const RouterOwnerOverridePendingAdministratorArgsSchema =
  RouterOwnerProposeAdministratorArgsSchema;

export const RouterAcceptAdminRoleArgsSchema = z.object({
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

export const RouterTransferAdminRoleArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  newAdmin: z.string().transform(val => new PublicKey(val)),
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

export const RouterSetPoolArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  poolLookupTable: z.string().transform(val => new PublicKey(val)),
  writableIndexes: z.string().transform(val => {
    try {
      const parsed = JSON.parse(val);
      if (!Array.isArray(parsed)) throw new Error('Writable indexes must be a JSON array');
      const nums = parsed.map((n: unknown) => {
        const num = Number(n);
        if (!Number.isInteger(num) || num < 0 || num > 255) {
          throw new Error('Each writable index must be an integer between 0 and 255');
        }
        return num;
      });
      return nums as number[];
    } catch (e) {
      throw new Error(
        `Invalid JSON for writable indexes: ${e instanceof Error ? e.message : String(e)}`
      );
    }
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

// Router ALT creation
export const RouterCreateLookupTableArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)), // router program id
  feeQuoterProgramId: z.string().transform(val => new PublicKey(val)),
  poolProgramId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  additionalAddresses: z
    .string()
    .optional()
    .transform(val => {
      if (!val) return [] as PublicKey[];
      try {
        const parsed = JSON.parse(val);
        if (!Array.isArray(parsed)) throw new Error('Must be a JSON array');
        return parsed.map((a: unknown) => new PublicKey(String(a)));
      } catch (e) {
        throw new Error(
          `Invalid JSON for additional addresses: ${e instanceof Error ? e.message : String(e)}`
        );
      }
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
