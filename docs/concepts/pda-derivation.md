---
type: concept
title: PDA Derivation and Account Metas
---

# PDA Derivation and Account Metas

Every instruction needs an ordered list of account metas `{ pubkey, isSigner, isWritable }` and
several PDAs derived from seeds. Source: `src/programs/<prog>/accounts.ts`, `src/utils/accounts.ts`,
`src/utils/addresses.ts`, `src/utils/alt.ts`, seed constants in `src/utils/constants.ts`.
Instruction data bytes are covered in [encoding](../concepts/encoding.md).

## Seed constants (`src/utils/constants.ts`)

```ts
BURNMINT_TOKEN_POOL / LOCKRELEASE_TOKEN_POOL = {
  STATE_SEED:        'ccip_tokenpool_config',
  CHAIN_CONFIG_SEED: 'ccip_tokenpool_chainconfig',
  POOL_SIGNER_SEED:  'ccip_tokenpool_signer',
  CONFIG_SEED:       'config',
}                                    // both pools use identical seed strings
ROUTER_SEEDS = {
  CONFIG:                      'config',
  TOKEN_ADMIN_REGISTRY:        'token_admin_registry',
  EXTERNAL_TOKEN_POOLS_SIGNER: 'external_token_pools_signer',
}
FEE_QUOTER_SEEDS = { FEE_BILLING_TOKEN_CONFIG: 'fee_billing_token_config' }
PROGRAM_IDS = { BPF_LOADER_UPGRADEABLE_PROGRAM_ID: 'BPFLoaderUpgradeab1e11111111111111111111111' }
```

## Every PDA (seeds and owning program)

All derived with `PublicKey.findProgramAddressSync(seeds, programId)` returning
`[PublicKey, bump]`, except ATAs which use
`getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve = true, tokenProgram)`.

| PDA | Seeds (in order) | Derived against | Defined in |
| --- | --- | --- | --- |
| Pool **State** | `["ccip_tokenpool_config", mint]` | pool program | `src/programs/burnmint-token-pool/accounts.ts`, `src/programs/lockrelease-token-pool/accounts.ts` |
| **Chain Config** | `["ccip_tokenpool_chainconfig", u64LE(selector), mint]` | pool program | same files |
| **Pool Signer** | `["ccip_tokenpool_signer", mint]` | pool program | same files |
| **Global Config** | `["config"]` | pool program | same files |
| **Program Data** | `[programId]` | `BPFLoaderUpgradeab1e…` | same files |
| **Pool Token Account** (ATA) | ATA(mint, owner = poolSigner, tokenProgram) | ATA program | `src/programs/lockrelease-token-pool/accounts.ts` |
| Router **Config** | `["config"]` | router program | `src/programs/router/accounts.ts` |
| **Token Admin Registry** | `["token_admin_registry", mint]` | router program | `src/programs/router/accounts.ts` |
| **External Token Pools Signer** | `["external_token_pools_signer", poolProgramId]` | router program | `src/programs/router/accounts.ts` |
| **Fee Billing Token Config** | `["fee_billing_token_config", mint]` | fee-quoter program | `src/utils/alt.ts` |

### Chain selector encoding (critical)

The `remoteChainSelector` (a `u64`) is always serialized **little-endian into an 8-byte buffer**
before being used as a seed:

```ts
const buf = Buffer.alloc(8);
buf.writeBigUInt64LE(remoteChainSelector);   // seed component
```

The same LE encoding is used in instruction **data** ([encoding](../concepts/encoding.md)).
Mismatched endianness derives a different address ("PDA not found").

## The `AccountBuilder` meta pattern (`src/utils/accounts.ts`)

A fluent builder accumulating `{ pubkey, isSigner, isWritable }`; `.build()` returns the array.

| Method | Effect |
| --- | --- |
| `.add(pubkey, isSigner = false, isWritable = false)` | explicit flags |
| `.addSigner(pubkey, isWritable = false)` | signer; optionally writable |
| `.addWritable(pubkey, isSigner = false)` | writable; optionally signer |
| `.addReadOnly(pubkey)` | read-only, non-signer |
| `.build()` | copy of the metas array |

**Account order matters** — it must match the on-chain program's expected order exactly. The
tables below list what each `*Accounts.<method>()` produces.


## Account layouts per instruction

Flags: `s` = signer, `w` = writable, `r` = read-only.

### Pool programs — shared shapes (burnmint and lockrelease)

| Instruction | Account order (idx: name [flags]) |
| --- | --- |
| `initialize` | 0 State [w] · 1 Mint [r] · 2 Authority [s,w] · 3 SystemProgram [r] · 4 Program [r] · 5 ProgramData [r] · 6 GlobalConfig [r] |
| `acceptOwnership` / `transferOwnership` | 0 State [w] · 1 Mint [r] · 2 Authority [s] |
| `setRateLimitAdmin` | 0 State [w] · 1 Authority [s,w] |
| `setChainRateLimit` | 0 State [r] · 1 ChainConfig [w] · 2 Authority [s,w] |
| `initChainRemoteConfig` / `editChainRemoteConfig` / `appendRemotePoolAddresses` | 0 State [r] · 1 ChainConfig [w] · 2 Authority [s,w] · 3 SystemProgram [r] |
| `deleteChainConfig` | 0 State [r] · 1 ChainConfig [w] · 2 Authority [s,w] |
| `configureAllowList` / `removeFromAllowList` | 0 State [w] · 1 Mint [r] · 2 Authority [s,w] · 3 SystemProgram [r] |

### Lockrelease-only

| Instruction | Account order |
| --- | --- |
| `provideLiquidity` / `withdrawLiquidity` | 0 State [r] · 1 TokenProgram [r] · 2 Mint [w] · 3 PoolSigner [r] · 4 PoolTokenAccount(ATA) [w] · 5 UserTokenAccount(ATA) [w] · 6 Authority [s] |
| `setCanAcceptLiquidity` / `setRebalancer` | 0 State [w] · 1 Mint [r] · 2 Authority [s] |

> The "user token account" (idx 5) is the rebalancer's ATA, auto-derived from the authority plus
> the detected token program. `PoolTokenAccount` is the ATA owned by the pool signer PDA
> (`allowOwnerOffCurve = true`). The token program is auto-detected from the mint
> (`detectTokenProgramId`, see [utilities](../reference/utilities.md)).

### Router

| Instruction | Account order |
| --- | --- |
| `ownerProposeAdministrator` / `ownerOverridePendingAdministrator` | 0 Config [r] · 1 TokenAdminRegistry [w] · 2 Mint [r] · 3 Authority [s,w] · 4 SystemProgram [r] |
| `acceptAdminRoleTokenAdminRegistry` / `transferAdminRoleTokenAdminRegistry` | 0 Config [r] · 1 TokenAdminRegistry [w] · 2 Mint [r] · 3 Authority [s,w] |
| `setPool` | 0 Config [r] · 1 TokenAdminRegistry [w] · 2 Mint [r] · 3 PoolLookupTable [r] · 4 Authority [s,w] |

Router note: the `config` and `token_admin_registry` PDAs are auto-derived — users never pass
them. Instruction semantics live in [router](../programs/router.md).

## Hex / address helpers (`src/utils/addresses.ts`)

EVM/remote addresses arrive as hex strings and become byte buffers for instruction data:

| Function | Behavior |
| --- | --- |
| `normalizeHexString(s)` | strip optional `0x`, lowercase |
| `hexToBytes(s)` | normalize, validate `^[0-9a-fA-F]*$`, then `Buffer.from(hex, 'hex')` (throws on bad hex) |
| `leftPad(buf, n)` | left-pad with zero bytes to `n` (throws if longer) |
| `hexToPadded32Bytes(s)` | `hexToBytes` then `leftPad(…, 32)` — used for the 32-byte remote **token** address |

Remote **pool** addresses keep their natural length (e.g. 20 bytes for EVM); the remote **token**
address is left-padded to 32. See the `RemoteAddress` layout in
[encoding](../concepts/encoding.md).

## ALT address derivation (`src/utils/alt.ts`)

- `deriveCcipBaseAddresses(...)` — the deterministic **10 base addresses** for a token's ALT, in a
  fixed order: ALT address, TokenAdminRegistry, pool program id, pool config (State), pool token
  ATA, pool signer, token program, mint, fee-billing-token-config, router external-pools-signer.
- `buildCreateAndExtendAlt(...)` — `AddressLookupTableProgram.createLookupTable()` plus extend
  instructions in **chunks of 30** (cap **256** addresses total).
- `buildAppendToAlt(...)` — fetches the existing ALT, verifies authority, appends in chunks of 30
  (cap 256).
- Standalone create: `scripts/create-alt.ts` derives the ALT PDA from `[authority, recentSlot_LE]`
  against `AddressLookupTableProgram.programId` (instruction discriminator `0`, 13-byte data).
  Slot-dependent, and the transaction's blockhash expires first, so it must execute within roughly 60-90 seconds - hence EOA execution.

## Debugging: `utils derive-accounts`

`src/commands/utils/derive-accounts.ts` is a read-only helper that prints the PDAs for one
`--program-type` (`burnmint-token-pool`, `lockrelease-token-pool`, `router`, `spl-token`) —
name, address, seed formula, bump — from `--program-id` + `--mint`, plus optional
`--remote-chain-selector` and `--pool-program-id`. Command surface:
[commands](../commands/index.md).
