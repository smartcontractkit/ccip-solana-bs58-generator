---
type: reference
title: Validation and Types
---

# Validation and Types

The boundary that turns raw CLI strings into typed domain objects.
Source: `src/utils/validation.ts`, `src/types/index.ts`, `src/types/command.ts`, `src/types/program-registry.ts`.
Related: [CLI commands](../commands/index.md), [architecture](../concepts/architecture.md).

## validateArgs

`validateArgs(schema, data)` in `src/utils/validation.ts`:

```ts
const result = schema.safeParse(data);
if (result.success) return { success: true, data: result.data };
const errors = result.error.issues.map(e =>
  `${e.path.length ? e.path.join('.') + ': ' : ''}${e.message}`);
return { success: false, errors };
```

- Uses Zod `safeParse` (never throws) and returns a discriminated union.
- Handlers print `errors` with hints and `process.exit(1)` on failure.
- `isValidUrl(v)` helper wraps `new URL(v)` in try/catch.

## Zod schemas

One schema per instruction in `src/types/index.ts`, e.g. `AcceptOwnershipArgsSchema`,
`BaseInitializePoolArgsSchema` (aliased as `BurnmintInitializePoolArgsSchema`,
`LockreleaseInitializePoolArgsSchema`, and `CreateTokenAccountArgsSchema`),
`TransferOwnershipArgsSchema`, `SetChainRateLimitArgsSchema`, `InitChainRemoteConfigArgsSchema`
(aliased as `EditChainRemoteConfigArgsSchema`), `InspectTokenArgsSchema`, the `Router*ArgsSchema`
family, `CreateAltArgsSchema`, the `Spl*ArgsSchema` family, `MetaplexUpdateAuthorityArgsSchema`,
`CreateMintArgsSchema`. `DeriveAccountsArgsSchema` is local to
`src/commands/utils/derive-accounts.ts`, not exported from `types/index.ts`.

`SplTransferFreezeAuthorityArgsSchema` is defined in `types/index.ts` but is not wired to any CLI
instruction (no `transfer-freeze-authority` route in `src/commands/spl-token/index.ts`).

### Coercion rules (string to type)

| Input | Schema pattern | Result |
| --- | --- | --- |
| Base58 string | `z.string().transform(v => new PublicKey(v))` | `PublicKey` (`PublicKey` throws — "Non-base58 character" for bad characters, "Invalid public key input" for a wrong-length key) |
| numeric string | `z.string().transform(v => BigInt(v))` | `bigint` for u64 (selector, capacity, rate, amount) |
| `"true"`/`"false"` | `.transform()` checking literals | `boolean` (throws otherwise; most schemas lowercase first, `SetCanAcceptLiquidityArgsSchema` matches exactly) |
| JSON array string | `.transform(v => JSON.parse(v))` + array check | `string[]` (remote/pool addresses, passed through verbatim), `PublicKey[]` (allow-list entries), or `number[]` (`writableIndexes`, each 0–255) |
| hex string | `.refine(/^(0x)?[0-9a-fA-F]+$/)` + `0x` strip | `tokenAddress`; lowercasing happens later in `normalizeHexString` (`src/utils/addresses.ts`), not in the schema |
| URL string | `.refine(v => new URL(v) ok)` | validated `rpcUrl` (optional) |

`rpcUrl` is supplied by handlers from `globalOptions.resolvedRpcUrl` (set by the global `preAction`
hook in `src/index.ts`).

## Idl type

`export type { Idl } from '@coral-xyz/anchor';` (`src/types/index.ts`) — re-exported so the rest of
the codebase imports `Idl` from `../types`. Used for `validateInstructionExists`
(see [encoding](../concepts/encoding.md)).

## Program registry

`PROGRAM_REGISTRY` (`src/types/program-registry.ts`) maps each IDL-backed program name
(`burnmint-token-pool`, `lockrelease-token-pool`, `router`) to
`{ name, displayName, description, hasIdl, idl, supportedInstructions[] }`, with the IDL JSON
imported from `src/programs/<prog>/idl.json`. Accessors: `getProgramConfig(name)` and
`getIdlEnabledPrograms()`. `ProgramName` is the keyof union. Handlers call
`getProgramConfig(programType)` to fetch `.idl` for the `InstructionBuilder`. Pool
`supportedInstructions` are camelCase (`acceptOwnership`), router entries are snake_case IDL names
(`owner_propose_administrator`).

## command.ts

Per-command option interfaces (`TransferOwnershipOptions`, `GlobalCommandOptions`,
`CommandContext`, ...). `CommandContext` models commander's nested `command.parent?.parent?.opts()`
used to reach `resolvedRpcUrl`. `GlobalCommandOptions` also carries `execute`, `keypair`, `format`,
and a cached `_signerKeypair` (see [EOA execution](../concepts/eoa-execution.md)).

See also: [glossary](glossary.md), [utilities](utilities.md), [gotchas](../gotchas/index.md).
