import { describe, it, expect } from 'vitest';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  AcceptOwnershipArgsSchema,
  TransferOwnershipArgsSchema,
  SetRateLimitAdminArgsSchema,
  GetStateArgsSchema,
  GetChainConfigArgsSchema,
  InspectTokenArgsSchema,
  SetChainRateLimitArgsSchema,
  InitChainRemoteConfigArgsSchema,
  EditChainRemoteConfigArgsSchema,
  AppendRemotePoolAddressesArgsSchema,
  ProvideLiquidityArgsSchema,
  WithdrawLiquidityArgsSchema,
  DeleteChainConfigArgsSchema,
  ConfigureAllowListArgsSchema,
  RemoveFromAllowListArgsSchema,
  ApproveArgsSchema,
  SplMintArgsSchema,
  SplCreateMultisigArgsSchema,
  SplTransferMintAuthorityArgsSchema,
  CreateMintArgsSchema,
} from '../src/types/index.js';

const PK = '2SGSoyjD1QLEpL8SsA2Zhc51jRCQPiZ6GjJWZGkvC3V3';
const PK2 = 'BPympxtoS3GZmNcGiTxqsH6kyRgKiS9QFjfviSLaqxRE';
const RPC = 'https://api.devnet.solana.com';
const ETH_SELECTOR = '1601528660175788095';

const ok = (r: { success: boolean }) => expect(r.success).toBe(true);
// In zod v4 a .transform() that throws propagates out of safeParse (it is NOT caught into
// {success:false}). So a "rejects" case is either a failed result OR a thrown error.
const bad = (thunk: () => { success: boolean }) => {
  let r: { success: boolean } | null;
  try {
    r = thunk();
  } catch {
    r = null;
  }
  expect(r === null || r.success === false).toBe(true);
};

describe('base schemas: pubkey + URL validation', () => {
  it('AcceptOwnershipArgsSchema accepts valid and rejects bad pubkey / bad URL', () => {
    ok(
      AcceptOwnershipArgsSchema.safeParse({ programId: PK, mint: PK, authority: PK, rpcUrl: RPC })
    );
    bad(() =>
      AcceptOwnershipArgsSchema.safeParse({ programId: 'not-a-pubkey', mint: PK, authority: PK })
    );
    bad(() =>
      AcceptOwnershipArgsSchema.safeParse({ programId: PK, mint: PK, authority: PK, rpcUrl: 'no' })
    );
  });

  it('GetStateArgsSchema does NOT require authority (read-only)', () => {
    ok(GetStateArgsSchema.safeParse({ programId: PK, mint: PK, rpcUrl: RPC }));
  });

  it('TransferOwnershipArgsSchema requires proposedOwner', () => {
    ok(
      TransferOwnershipArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        authority: PK,
        proposedOwner: PK2,
        rpcUrl: RPC,
      })
    );
    bad(() => TransferOwnershipArgsSchema.safeParse({ programId: PK, mint: PK, authority: PK }));
  });

  it('SetRateLimitAdminArgsSchema requires newRateLimitAdmin', () => {
    ok(
      SetRateLimitAdminArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        authority: PK,
        newRateLimitAdmin: PK2,
        rpcUrl: RPC,
      })
    );
    bad(() => SetRateLimitAdminArgsSchema.safeParse({ programId: PK, mint: PK, authority: PK }));
  });
});

describe('SetChainRateLimitArgsSchema', () => {
  const base = {
    programId: PK,
    mint: PK,
    authority: PK,
    remoteChainSelector: ETH_SELECTOR,
    inboundEnabled: 'true',
    inboundCapacity: '1000',
    inboundRate: '10',
    outboundEnabled: 'false',
    outboundCapacity: '500',
    outboundRate: '5',
    rpcUrl: RPC,
  };

  it('accepts a full valid payload', () => ok(SetChainRateLimitArgsSchema.safeParse(base)));

  it('parses booleans case-insensitively', () => {
    const r = SetChainRateLimitArgsSchema.safeParse({
      ...base,
      inboundEnabled: 'TRUE',
      outboundEnabled: 'False',
    });
    ok(r);
    if (r.success) {
      expect(r.data.inboundEnabled).toBe(true);
      expect(r.data.outboundEnabled).toBe(false);
    }
  });

  it('rejects non-boolean strings for enabled', () => {
    bad(() => SetChainRateLimitArgsSchema.safeParse({ ...base, inboundEnabled: 'yes' }));
  });

  it('rejects negative capacity/rate/selector', () => {
    bad(() => SetChainRateLimitArgsSchema.safeParse({ ...base, inboundCapacity: '-1' }));
    bad(() => SetChainRateLimitArgsSchema.safeParse({ ...base, inboundRate: '-1' }));
    bad(() => SetChainRateLimitArgsSchema.safeParse({ ...base, remoteChainSelector: '-1' }));
  });
});

describe('InitChainRemoteConfigArgsSchema', () => {
  const base = {
    programId: PK,
    mint: PK,
    authority: PK,
    remoteChainSelector: ETH_SELECTOR,
    poolAddresses: '[]',
    tokenAddress: '0x9876dcba',
    decimals: '18',
    rpcUrl: RPC,
  };

  it('accepts a valid payload and strips 0x from tokenAddress', () => {
    const r = InitChainRemoteConfigArgsSchema.safeParse(base);
    ok(r);
    if (r.success) expect(r.data.tokenAddress).toBe('9876dcba');
  });

  it('accepts tokenAddress without 0x prefix', () => {
    const r = InitChainRemoteConfigArgsSchema.safeParse({ ...base, tokenAddress: '9876dcba' });
    ok(r);
    if (r.success) expect(r.data.tokenAddress).toBe('9876dcba');
  });

  it('rejects non-hex tokenAddress', () => {
    bad(() => InitChainRemoteConfigArgsSchema.safeParse({ ...base, tokenAddress: 'xyz' }));
  });

  it('rejects decimals > 255 and < 0', () => {
    bad(() => InitChainRemoteConfigArgsSchema.safeParse({ ...base, decimals: '256' }));
    bad(() => InitChainRemoteConfigArgsSchema.safeParse({ ...base, decimals: '-1' }));
  });

  it('parses poolAddresses JSON array', () => {
    const r = InitChainRemoteConfigArgsSchema.safeParse({
      ...base,
      poolAddresses: '["0x12","0x34"]',
    });
    ok(r);
    if (r.success) expect(r.data.poolAddresses).toEqual(['0x12', '0x34']);
  });

  it('rejects non-array poolAddresses', () => {
    bad(() => InitChainRemoteConfigArgsSchema.safeParse({ ...base, poolAddresses: '"notarray"' }));
  });

  it('EditChainRemoteConfigArgsSchema is the same schema as init', () => {
    expect(EditChainRemoteConfigArgsSchema).toBe(InitChainRemoteConfigArgsSchema);
  });
});

describe('AppendRemotePoolAddressesArgsSchema', () => {
  it('parses addresses JSON array', () => {
    const r = AppendRemotePoolAddressesArgsSchema.safeParse({
      programId: PK,
      mint: PK,
      authority: PK,
      remoteChainSelector: ETH_SELECTOR,
      addresses: '["0x12","0x34"]',
      rpcUrl: RPC,
    });
    ok(r);
    if (r.success) expect(r.data.addresses).toEqual(['0x12', '0x34']);
  });

  it('rejects non-array addresses', () => {
    bad(() =>
      AppendRemotePoolAddressesArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        authority: PK,
        remoteChainSelector: ETH_SELECTOR,
        addresses: '5',
        rpcUrl: RPC,
      })
    );
  });
});

describe('ProvideLiquidityArgsSchema', () => {
  it('rejects amount <= 0 (stricter than mint)', () => {
    bad(() =>
      ProvideLiquidityArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        authority: PK,
        amount: '0',
        rpcUrl: RPC,
      })
    );
    bad(() =>
      ProvideLiquidityArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        authority: PK,
        amount: '-5',
        rpcUrl: RPC,
      })
    );
  });

  it('accepts positive amount', () => {
    ok(
      ProvideLiquidityArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        authority: PK,
        amount: '1',
        rpcUrl: RPC,
      })
    );
  });

  it('defaults autoApprove to false', () => {
    const r = ProvideLiquidityArgsSchema.safeParse({
      programId: PK,
      mint: PK,
      authority: PK,
      amount: '1',
      rpcUrl: RPC,
    });
    ok(r);
    if (r.success) expect(r.data.autoApprove).toBe(false);
  });
});

describe('DeleteChainConfigArgsSchema', () => {
  it('requires remoteChainSelector and rejects negative', () => {
    ok(
      DeleteChainConfigArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        authority: PK,
        remoteChainSelector: ETH_SELECTOR,
        rpcUrl: RPC,
      })
    );
    bad(() =>
      DeleteChainConfigArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        authority: PK,
        remoteChainSelector: '-1',
        rpcUrl: RPC,
      })
    );
  });
});

describe('ConfigureAllowListArgsSchema', () => {
  it('parses add as PublicKey array and enabled as boolean', () => {
    const r = ConfigureAllowListArgsSchema.safeParse({
      programId: PK,
      mint: PK,
      authority: PK,
      add: JSON.stringify([PK, PK2]),
      enabled: 'true',
      rpcUrl: RPC,
    });
    ok(r);
    if (r.success) {
      expect(r.data.add).toHaveLength(2);
      expect(r.data.add[0]).toBeInstanceOf(PublicKey);
      expect(r.data.enabled).toBe(true);
    }
  });

  it('rejects invalid pubkey in add', () => {
    bad(() =>
      ConfigureAllowListArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        authority: PK,
        add: '["nope"]',
        enabled: 'true',
        rpcUrl: RPC,
      })
    );
  });

  it('rejects non-boolean enabled', () => {
    bad(() =>
      ConfigureAllowListArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        authority: PK,
        add: '[]',
        enabled: 'maybe',
        rpcUrl: RPC,
      })
    );
  });
});

describe('RemoveFromAllowListArgsSchema', () => {
  it('parses remove as PublicKey array', () => {
    const r = RemoveFromAllowListArgsSchema.safeParse({
      programId: PK,
      mint: PK,
      authority: PK,
      remove: JSON.stringify([PK]),
      rpcUrl: RPC,
    });
    ok(r);
    if (r.success) expect(r.data.remove[0]).toBeInstanceOf(PublicKey);
  });
});

describe('ApproveArgsSchema', () => {
  it('accepts valid and makes tokenAccount optional', () => {
    ok(
      ApproveArgsSchema.safeParse({
        mint: PK,
        delegate: PK2,
        authority: PK,
        amount: '500',
        rpcUrl: RPC,
      })
    );
    ok(
      ApproveArgsSchema.safeParse({
        mint: PK,
        tokenAccount: PK2,
        delegate: PK,
        authority: PK,
        amount: '500',
        rpcUrl: RPC,
      })
    );
  });
});

describe('SplMintArgsSchema', () => {
  it('rejects negative amount, accepts 0', () => {
    bad(() =>
      SplMintArgsSchema.safeParse({
        authority: PK,
        mint: PK,
        recipient: PK2,
        amount: '-1',
        rpcUrl: RPC,
      })
    );
    ok(
      SplMintArgsSchema.safeParse({
        authority: PK,
        mint: PK,
        recipient: PK2,
        amount: '0',
        rpcUrl: RPC,
      })
    );
  });

  it('parses multisigSigners JSON array of base58', () => {
    const r = SplMintArgsSchema.safeParse({
      authority: PK,
      mint: PK,
      recipient: PK2,
      amount: '1',
      multisigSigners: JSON.stringify([PK, PK2]),
      rpcUrl: RPC,
    });
    ok(r);
    if (r.success) expect(r.data.multisigSigners).toHaveLength(2);
  });

  it('rejects invalid base58 in multisigSigners', () => {
    bad(() =>
      SplMintArgsSchema.safeParse({
        authority: PK,
        mint: PK,
        recipient: PK2,
        amount: '1',
        multisigSigners: '["nope"]',
        rpcUrl: RPC,
      })
    );
  });
});

describe('SplCreateMultisigArgsSchema', () => {
  const base = (signers: string[], threshold: string) => ({
    authority: PK,
    seed: 's',
    mint: PK,
    signers: JSON.stringify(signers),
    threshold,
    rpcUrl: RPC,
  });

  it('rejects threshold > signers (permanently unusable multisig)', () => {
    bad(() => SplCreateMultisigArgsSchema.safeParse(base([PK, PK2], '3')));
  });

  it('accepts threshold within signers', () => {
    ok(SplCreateMultisigArgsSchema.safeParse(base([PK, PK2], '2')));
  });

  it('rejects threshold <= 0', () => {
    bad(() => SplCreateMultisigArgsSchema.safeParse(base([PK, PK2], '0')));
  });

  it('rejects 0 and 12 signers (MAX_SIGNERS=11), accepts 1 and 11', () => {
    const eleven = Array.from({ length: 11 }, () => Keypair.generate().publicKey.toBase58());
    const twelve = Array.from({ length: 12 }, () => Keypair.generate().publicKey.toBase58());
    bad(() => SplCreateMultisigArgsSchema.safeParse(base([], '1')));
    bad(() => SplCreateMultisigArgsSchema.safeParse(base(twelve, '1')));
    ok(SplCreateMultisigArgsSchema.safeParse(base([PK], '1')));
    ok(SplCreateMultisigArgsSchema.safeParse(base(eleven, '1')));
  });
});

describe('SplTransferMintAuthorityArgsSchema', () => {
  it('accepts valid', () => {
    ok(
      SplTransferMintAuthorityArgsSchema.safeParse({
        authority: PK,
        mint: PK,
        newMintAuthority: PK2,
        rpcUrl: RPC,
      })
    );
  });
});

describe('CreateMintArgsSchema', () => {
  it('defaults tokenProgram to spl-token and withMetaplex to false', () => {
    const r = CreateMintArgsSchema.safeParse({ authority: PK, decimals: 6 });
    ok(r);
    if (r.success) {
      expect(r.data.tokenProgram).toBe('spl-token');
      expect(r.data.withMetaplex).toBe(false);
    }
  });

  it('rejects decimals > 255 and < 0', () => {
    bad(() => CreateMintArgsSchema.safeParse({ authority: PK, decimals: 256 }));
    bad(() => CreateMintArgsSchema.safeParse({ authority: PK, decimals: -1 }));
  });

  it('rejects name > 32 chars and symbol > 10 chars', () => {
    bad(() => CreateMintArgsSchema.safeParse({ authority: PK, decimals: 6, name: 'x'.repeat(33) }));
    bad(() =>
      CreateMintArgsSchema.safeParse({ authority: PK, decimals: 6, symbol: 'x'.repeat(11) })
    );
  });

  it('metadata enum is none|metaplex|token-2022', () => {
    ok(CreateMintArgsSchema.safeParse({ authority: PK, decimals: 6, metadata: 'token-2022' }));
    bad(() => CreateMintArgsSchema.safeParse({ authority: PK, decimals: 6, metadata: 'other' }));
  });
});

describe('InspectTokenArgsSchema', () => {
  it('requires programId, mint, poolProgramId; feeQuoterProgramId optional', () => {
    ok(
      InspectTokenArgsSchema.safeParse({ programId: PK, mint: PK, poolProgramId: PK2, rpcUrl: RPC })
    );
    ok(
      InspectTokenArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        poolProgramId: PK2,
        feeQuoterProgramId: PK,
        rpcUrl: RPC,
      })
    );
    bad(() => InspectTokenArgsSchema.safeParse({ programId: PK, mint: PK, rpcUrl: RPC }));
  });
});

describe('GetChainConfigArgsSchema', () => {
  it('requires remoteChainSelector and rejects negative', () => {
    ok(
      GetChainConfigArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        remoteChainSelector: ETH_SELECTOR,
        rpcUrl: RPC,
      })
    );
    bad(() =>
      GetChainConfigArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        remoteChainSelector: '-1',
        rpcUrl: RPC,
      })
    );
  });
});

describe('WithdrawLiquidityArgsSchema', () => {
  it('accepts valid', () => {
    ok(
      WithdrawLiquidityArgsSchema.safeParse({
        programId: PK,
        mint: PK,
        authority: PK,
        amount: '1',
        rpcUrl: RPC,
      })
    );
  });
});
