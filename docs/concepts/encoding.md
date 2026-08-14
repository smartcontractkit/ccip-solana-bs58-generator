---
type: concept
title: Instruction Encoding (Anchor Discriminators and Borsh)
---

# Instruction Encoding (Anchor Discriminators and Borsh)

How the **data bytes** of each instruction are built. The Anchor programs (burnmint, lockrelease,
router) share a discriminator-plus-manual-Borsh approach; spl-token and metaplex bypass it
entirely. Source: `src/utils/anchor.ts`, `src/programs/<prog>/instructions.ts`,
`src/types/index.ts`. Account metas are the other half of an instruction — see
[pda-derivation](../concepts/pda-derivation.md).

## `AnchorUtils` (`src/utils/anchor.ts`)

### Discriminator — `calculateDiscriminator(name)`

```ts
sha256(`global:${instructionName}`).subarray(0, 8)   // first 8 bytes
```

- Input is the **snake_case** instruction name (e.g. `set_chain_rate_limit`), case-sensitive.
- Uses Node `crypto.createHash('sha256')`.

### Assembly — `buildInstruction(name, programId, accounts, data?)`

```ts
const discriminator = calculateDiscriminator(name);
const instructionData = data ? Buffer.concat([discriminator, data]) : discriminator;
return new TransactionInstruction({
  keys: accounts.map(a => ({ pubkey: a.pubkey, isSigner: a.isSigner, isWritable: a.isWritable })),
  programId,
  data: instructionData,
});
```

- If an instruction takes no args, the data is the 8-byte discriminator only.
- Otherwise the caller serializes args into `data` and the discriminator is prepended.

### Guard — `validateInstructionExists(idl, name)`

Looks up `idl.instructions.find(ix => ix.name === name)`; throws listing available names if
missing. Called at the top of most builder methods with the IDL's own spelling of the name — which
is **not** the snake_case string later passed to `buildInstruction` for the pool programs. The `Idl` type is re-exported from
`@coral-xyz/anchor` in `src/types/index.ts`.

## The `InstructionBuilder` pattern

`new InstructionBuilder(programId, idl)`; each method:

1. `AnchorUtils.validateInstructionExists(idl, '<idl_name>')` — the lookup uses the name as the
   IDL spells it: camelCase in the pool IDLs (`setChainRateLimit`), snake_case in the router IDL
   (`set_pool`)
2. `accounts = <Prog>Accounts.<method>(...).build()` (see
   [pda-derivation](../concepts/pda-derivation.md))
3. serialize args into a `Buffer` (manual — layouts below)
4. `return AnchorUtils.buildInstruction('<snake_name>', programId, accounts, data)`

> **Method name vs IDL name**: builder methods are camelCase (`acceptOwnership`) but the string
> passed to `buildInstruction` is **snake_case** (`accept_ownership`). That string drives the
> discriminator, so it must match the on-chain program exactly.

## Primitive encoding rules (Borsh)

| Type | Bytes | How |
| --- | --- | --- |
| `PublicKey` | 32 | `pk.toBuffer()` |
| `u64` | 8 | `buf.writeBigUInt64LE(v, off)` — **little-endian** |
| `u32` | 4 | `buf.writeUInt32LE(v, off)` |
| `u8` | 1 | `buf.writeUInt8(v, off)` |
| `bool` | 1 | `Buffer.from([v ? 1 : 0])` |
| `Vec<T>` | 4 + N·size | `u32 LE length` prefix, then elements |
| `RemoteAddress` | 4 + len | `u32 LE length` prefix, then raw address bytes |
| `string` (rare) | 4 + len | `u32 LE length` + utf-8 bytes |

Builders assemble either by `Buffer.alloc(totalLen)` plus offset writes (fixed-size args) or by
pushing into a `Buffer[]` and `Buffer.concat()` (variable-size args).

## Worked byte layouts

### Fixed: `set_rate_limit_admin` (64 bytes of data)

```
[0..32)  mint              (32)
[32..64) newRateLimitAdmin (32)
```

### Other fixed layouts

- `transfer_ownership` (32) — only `proposedOwner`. `set_rebalancer` (32) — `rebalancer`.
- `provide_liquidity` / `withdraw_liquidity` (8) — `u64 LE amount`.
- `set_can_accept_liquidity` (1) — `bool`.
- `delete_chain_config` (40) — `u64 LE selector (8)` + `mint (32)`.

### Fixed struct: `set_chain_rate_limit` (74 bytes)

```
[0..8)   remoteChainSelector  u64 LE
[8..40)  mint                 32 bytes
[40]     inbound.enabled      u8 (0/1)
[41..49) inbound.capacity     u64 LE
[49..57) inbound.rate         u64 LE
[57]     outbound.enabled     u8 (0/1)
[58..66) outbound.capacity    u64 LE
[66..74) outbound.rate        u64 LE
```

### Vec of pubkeys: `configure_allow_list`

```
u32 LE add.length
add.length x 32-byte PublicKey
u8 enabled (0/1)
```

`remove_from_allow_list`: `u32 LE len` + `len x 32-byte PublicKey`.

### Nested vec: `init_chain_remote_config` / `edit_chain_remote_config`

```
u64 LE remoteChainSelector
32     mint
u32 LE poolAddresses.length
  for each pool address (RemoteAddress):
    u32 LE len
    len bytes (hexToBytes(addr) — natural length, e.g. 20 for EVM)
RemoteAddress tokenAddress:
    u32 LE len   (= 32)
    32 bytes (hexToPadded32Bytes(tokenAddress))
u8 decimals
```

`append_remote_pool_addresses`: `u64 LE selector` + `mint` + `Vec<RemoteAddress>` of the new
addresses.

### Router `set_pool` — `Vec<u8>` writable indexes

```
u32 LE writableIndexes.length
length x u8
```

### No-arg instructions (discriminator only)

`initialize`, `accept_ownership`, `accept_admin_role_token_admin_registry`.

### Router pubkey-arg instructions (32 bytes)

`owner_propose_administrator`, `owner_override_pending_administrator`,
`transfer_admin_role_token_admin_registry` — a single `PublicKey` (the admin / new admin).

## Non-Anchor programs

These do not use `AnchorUtils` and none uses an Anchor discriminator, but they are not
discriminator-free:

- SPL Token / Token-2022: a 1-byte instruction tag (`InitializeMint` 0, `InitializeMultisig` 2,
  `Approve` 4, `SetAuthority` 6, `MintTo` 7).
- Token-2022 metadata-interface instructions (`InitializeTokenMetadata`, `UpdateAuthority`): an
  8-byte `sha256("spl_token_metadata_interface:<name>")[0..8]` discriminator - same width as
  Anchor's, different preimage.
- Metaplex: a `u8` Borsh enum variant index (`updateV1` = 50).

[spl-token](../programs/spl-token.md) builds instructions with `@solana/spl-token` helpers
(`createMintToInstruction`, `createSetAuthorityInstruction`, `createInitializeMintInstruction`,
`createApproveInstruction`, `createInitializeMultisigInstruction`,
`createAssociatedTokenAccountInstruction`, `createInitializeMetadataPointerInstruction`) and
`@solana/spl-token-metadata` (`createInitializeInstruction`, `createUpdateAuthorityInstruction`),
which encode the byte formats internally. [metaplex](../programs/metaplex.md) uses UMI (`updateV1`
from `mpl-token-metadata`), converted with `toWeb3JsInstruction()`.

## Where the IDL lives

`src/programs/<prog>/idl.json` for burnmint, lockrelease, router. Registered in
`src/types/program-registry.ts` (`PROGRAM_REGISTRY[name].idl` + `supportedInstructions[]`). The
IDL is used only for `validateInstructionExists` lookups — **arg serialization is hand-written**,
not driven by the IDL's type definitions, so byte layouts must be kept in sync with the on-chain
Rust program by hand. The reverse direction (reading accounts back) is equally manual:
[account-deserialization](../reference/account-deserialization.md).
