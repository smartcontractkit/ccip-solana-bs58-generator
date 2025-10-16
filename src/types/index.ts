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

// Base initialize pool schema (shared by all token pool types)
export const BaseInitializePoolArgsSchema = z.object({
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

// Burnmint initialize pool (uses base schema)
export const BurnmintInitializePoolArgsSchema = BaseInitializePoolArgsSchema;

// Lockrelease initialize pool (uses base schema)
export const LockreleaseInitializePoolArgsSchema = BaseInitializePoolArgsSchema;

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

export const SetRateLimitAdminArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  newRateLimitAdmin: z.string().transform(val => new PublicKey(val)),
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

export const GetStateArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
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

export const GetChainConfigArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
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

export const ProvideLiquidityArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  amount: z.string().transform(val => {
    const num = BigInt(val);
    if (num <= 0) throw new Error('Amount must be positive');
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

export const WithdrawLiquidityArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  amount: z.string().transform(val => {
    const num = BigInt(val);
    if (num <= 0) throw new Error('Amount must be positive');
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

export const SetRebalancerArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  rebalancer: z.string().transform(val => new PublicKey(val)),
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

export const SetCanAcceptLiquidityArgsSchema = z.object({
  programId: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  allow: z.string().transform(val => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    throw new Error('Allow must be "true" or "false"');
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

export const ApproveArgsSchema = z.object({
  mint: z.string().transform(val => new PublicKey(val)),
  tokenAccount: z
    .string()
    .optional()
    .transform(val => (val ? new PublicKey(val) : undefined)),
  delegate: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  amount: z.string().transform(val => BigInt(val)),
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

// Router ALT append
export const RouterAppendToLookupTableArgsSchema = z.object({
  lookupTableAddress: z.string().transform(val => new PublicKey(val)),
  authority: z.string().transform(val => new PublicKey(val)),
  additionalAddresses: z.string().transform(val => {
    try {
      const parsed = JSON.parse(val);
      if (!Array.isArray(parsed)) throw new Error('Must be a JSON array');
      if (parsed.length === 0) throw new Error('Must provide at least one address to append');
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

// SPL Token schemas
export const SplMintArgsSchema = z.object({
  authority: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  recipient: z.string().transform(val => new PublicKey(val)),
  amount: z.string().transform(val => {
    const num = BigInt(val);
    if (num < 0n) throw new Error('Amount must be non-negative');
    return num;
  }),
  multisig: z
    .string()
    .optional()
    .transform(val => (val ? new PublicKey(val) : undefined)),
  multisigSigners: z
    .string()
    .optional()
    .transform(val => {
      if (!val) return undefined;
      try {
        const parsed = JSON.parse(val);
        if (!Array.isArray(parsed)) throw new Error('Must be a JSON array');
        return parsed.map((a: unknown) => new PublicKey(String(a)));
      } catch (e) {
        throw new Error(
          `Invalid JSON for multisig signers: ${e instanceof Error ? e.message : String(e)}`
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

export const SplCreateMultisigArgsSchema = z.object({
  authority: z.string().transform(val => new PublicKey(val)),
  seed: z.string(),
  mint: z.string().transform(val => new PublicKey(val)),
  signers: z.string().transform(val => {
    try {
      const parsed = JSON.parse(val);
      if (!Array.isArray(parsed)) throw new Error('Must be a JSON array');
      return parsed.map((a: unknown) => new PublicKey(String(a)));
    } catch (e) {
      throw new Error(`Invalid JSON for signers: ${e instanceof Error ? e.message : String(e)}`);
    }
  }),
  threshold: z.string().transform(val => {
    const n = parseInt(val, 10);
    if (!Number.isInteger(n) || n <= 0) throw new Error('Threshold must be a positive integer');
    return n;
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

export const SplTransferMintAuthorityArgsSchema = z.object({
  authority: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  newMintAuthority: z.string().transform(val => new PublicKey(val)),
  multisig: z
    .string()
    .optional()
    .transform(val => (val ? new PublicKey(val) : undefined)),
  multisigSigners: z
    .string()
    .optional()
    .transform(val => {
      if (!val) return undefined;
      try {
        const parsed = JSON.parse(val);
        if (!Array.isArray(parsed)) throw new Error('Must be a JSON array');
        return parsed.map((a: unknown) => new PublicKey(String(a)));
      } catch (e) {
        throw new Error(
          `Invalid JSON for multisig signers: ${e instanceof Error ? e.message : String(e)}`
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

export const SplTransferFreezeAuthorityArgsSchema = z.object({
  authority: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  newFreezeAuthority: z.string().transform(val => new PublicKey(val)),
  multisig: z
    .string()
    .optional()
    .transform(val => (val ? new PublicKey(val) : undefined)),
  multisigSigners: z
    .string()
    .optional()
    .transform(val => {
      if (!val) return undefined;
      try {
        const parsed = JSON.parse(val);
        if (!Array.isArray(parsed)) throw new Error('Must be a JSON array');
        return parsed.map((a: unknown) => new PublicKey(String(a)));
      } catch (e) {
        throw new Error(
          `Invalid JSON for multisig signers: ${e instanceof Error ? e.message : String(e)}`
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

export const SplUpdateMetadataAuthorityArgsSchema = z.object({
  authority: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  metadataAccount: z
    .string()
    .optional()
    .transform(val => (val ? new PublicKey(val) : undefined)),
  newAuthority: z
    .string()
    .optional()
    .transform(val => (val ? new PublicKey(val) : null)),
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

// Metaplex (mpl-token-metadata) update authority
export const MetaplexUpdateAuthorityArgsSchema = z.object({
  authority: z.string().transform(val => new PublicKey(val)),
  mint: z.string().transform(val => new PublicKey(val)),
  newAuthority: z.string().transform(val => new PublicKey(val)),
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

// Create mint schema
export const CreateMintArgsSchema = z.object({
  authority: z.string().transform(val => new PublicKey(val)),
  decimals: z.number().int().min(0).max(255),
  tokenProgram: z.enum(['spl-token', 'token-2022']).default('spl-token'),
  withMetaplex: z.boolean().default(false),
  name: z.string().max(32).optional(),
  symbol: z.string().max(10).optional(),
  uri: z
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
  initialSupply: z
    .string()
    .transform(val => BigInt(val))
    .optional(),
  recipient: z
    .string()
    .transform(val => new PublicKey(val))
    .optional(),
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
