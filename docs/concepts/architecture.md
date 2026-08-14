---
type: concept
title: Architecture
---

# Architecture

## One-paragraph model

The CLI takes string args, validates and coerces them with Zod (see
[validation-and-types](../reference/validation-and-types.md)), asks a program-specific
`InstructionBuilder` to assemble a `TransactionInstruction` (account metas from
[pda-derivation](../concepts/pda-derivation.md), data bytes from
[encoding](../concepts/encoding.md)), and hands it to the generic `TransactionBuilder`, which
compiles a **legacy** message, simulates it, and emits Base58/Base64/hex (see
[transaction-pipeline](../concepts/transaction-pipeline.md)). `TransactionDisplay` prints a
Squads-ready blob. By default it never signs or sends; the operator pastes the encoded message into
a Squads multisig. Two exceptions sign with a local EOA keypair: the opt-in `--execute` mode
([eoa-execution](../concepts/eoa-execution.md)) and the standalone `scripts/create-alt.ts` (ALT
addresses are slot-derived and must be created immediately).

## Layers

```
CLI (commander)            src/index.ts, src/commands/**/index.ts
  routes --instruction
Command handlers           src/commands/shared/*, src/commands/<prog>/*
  validateArgs (Zod)
Program layer              src/programs/<prog>/instructions.ts  (data bytes)
                           src/programs/<prog>/accounts.ts      (account metas + PDAs)
  TransactionInstruction
Core pipeline              src/core/transaction-builder.ts      (compile, simulate, encode)
Finalizer                  src/utils/finalize-transaction.ts    (display OR --execute sign+send)
Display                    src/utils/display.ts
```

Cross-cutting: `src/utils/` (anchor, accounts, addresses, alt, constants, token, validation,
keypair, finalize-transaction, transaction-executor, logger, explorer, display) — see
[utilities](../reference/utilities.md) — and `src/types/` (Zod schemas, `Idl`, program registry).

## Directory map

| Path | Role |
| --- | --- |
| `src/index.ts` | CLI bootstrap, global options (`--env`, `--rpc-url`, `--execute`, `--keypair`, `--format`), env/RPC resolution (`preAction`) |
| `src/commands/index.ts` | `registerCommands()` — wires all command groups |
| `src/commands/<prog>/index.ts` | per-program command def: options, per-instruction validation, `--instruction` routing |
| `src/commands/shared/*.ts` | shared handlers used by both pool programs (validate, build, finalize) |
| `src/commands/router/*.ts`, `spl-token/*.ts`, `metaplex/*.ts`, `utils/*.ts` | program-specific handlers |
| `src/programs/<prog>/instructions.ts` | `InstructionBuilder` — encodes instruction data |
| `src/programs/<prog>/accounts.ts` | `AccountDerivation` (PDAs) + `*Accounts` (account-meta builders) |
| `src/programs/<prog>/idl.json` | Anchor IDL (burnmint, lockrelease, router only) |
| `src/core/transaction-builder.ts` | generic compile + simulate + encode |
| `src/utils/finalize-transaction.ts` | shared tail of every write command: display, or sign and send under `--execute` |
| `src/types/index.ts` | Zod arg schemas, re-exports `Idl` from `@coral-xyz/anchor` |
| `src/types/program-registry.ts` | `PROGRAM_REGISTRY` mapping name to IDL + supported instructions |
| `src/utils/*` | helpers, see [utilities](../reference/utilities.md) |
| `scripts/create-alt.ts` | standalone EOA-executed ALT creator (`pnpm create-alt`) |

## Programs

| Program | Alias | Nature |
| --- | --- | --- |
| [burnmint-token-pool](../programs/burnmint-token-pool.md) | `bm` | burn/mint pool, Anchor IDL |
| [lockrelease-token-pool](../programs/lockrelease-token-pool.md) | `lr` | lock/release + liquidity, Anchor IDL, superset of burnmint |
| [router](../programs/router.md) | `r` | token admin registry + ALT + `set_pool`, Anchor IDL |
| [spl-token](../programs/spl-token.md) | `spl` | non-Anchor, via `@solana/spl-token` |
| [metaplex](../programs/metaplex.md) | `mpl` | non-Anchor, via Metaplex UMI |

## Request lifecycle (write command)

1. `src/index.ts` global `preAction` resolves `--env`/`--rpc-url` into `opts.resolvedRpcUrl`
   (enforcing XOR), resolves the output format (`--format` > `CCIP_TX_OUTPUT_FORMAT` env >
   `base58`), validates `--execute`/`--keypair` combinations, and sets log level.
2. Program-group `preAction` checks `resolvedRpcUrl` exists, applies execute-mode authority
   derivation (`applyExecuteAuthority`, see [eoa-execution](../concepts/eoa-execution.md)), then
   validates instruction-specific required flags. Command surface: [commands](../commands/index.md).
3. `.action()` routes `options.instruction` (kebab-case) to a handler function.
4. Handler calls `validateArgs(Schema, {...})` to get typed values (`PublicKey`, `BigInt`, bool).
   See [validation-and-types](../reference/validation-and-types.md).
5. Handler picks an `InstructionBuilder` (burnmint vs lockrelease vs router) and awaits the method.
   - The builder derives account metas via `<Prog>Accounts.<method>(...).build()`
     ([pda-derivation](../concepts/pda-derivation.md)).
   - The builder serializes args and prepends the Anchor discriminator
     ([encoding](../concepts/encoding.md)).
6. `finalizeTransaction({ txBuilder, instructions, payer, instructionName, command })` builds the
   legacy message, simulates a v0 copy, encodes, and either prints the Squads blob or, under
   `--execute`, signs and sends ([transaction-pipeline](../concepts/transaction-pipeline.md),
   [eoa-execution](../concepts/eoa-execution.md)).

**Read-only path** (`get-state`, `get-chain-config`, router `inspect-token`, the `utils` group):
validate, derive PDA, `getAccountInfo`, manual Borsh-style deserialize, pretty print. No
transaction is built and `--authority` is not required. See
[account-deserialization](../reference/account-deserialization.md).

## Design rules and conventions

- **Legacy messages only** for output (`compileToLegacyMessage`) — Squads compatibility. A v0 copy
  is built solely to simulate. Details in
  [transaction-pipeline](../concepts/transaction-pipeline.md); see also
  [gotchas](../gotchas/index.md#legacy-message-squads).
- **Failed simulation ⇒ do not upload** the transaction to Squads (and `--execute` refuses to
  send). See [gotchas](../gotchas/index.md#failed-simulation-gate).
- **Two pool programs share code** via `src/commands/shared/*`, dispatching on
  `programType: ProgramName`.
- **CLI flags are kebab-case**; commander exposes them camelCase
  (`--token-admin-registry-admin` becomes `options.tokenAdminRegistryAdmin`).
- **`--authority`** in encode mode is the Squads **vault** address; in `--execute` mode it defaults
  to the local keypair's pubkey.
- **Manual binary (de)serialization** instead of the Anchor coder, for both instruction args and
  account reads. Byte layouts must stay in sync with the on-chain Rust program
  ([encoding](../concepts/encoding.md),
  [account-deserialization](../reference/account-deserialization.md)).
- Core encoding invariants (details in [encoding](../concepts/encoding.md)): u64 is
  little-endian, PublicKey is 32 raw bytes, `Vec<T>` gets a u32-LE length prefix.

## Where do I change X

| I want to… | Go to |
| --- | --- |
| Add a CLI flag / instruction route | `src/commands/<prog>/index.ts`, surface listed in [commands](../commands/index.md) |
| Change instruction data bytes | `src/programs/<prog>/instructions.ts`, see [encoding](../concepts/encoding.md) |
| Change which accounts an instruction uses | `src/programs/<prog>/accounts.ts`, see [pda-derivation](../concepts/pda-derivation.md) |
| Add a new PDA/seed | `src/utils/constants.ts` + `accounts.ts`, see [pda-derivation](../concepts/pda-derivation.md) |
| Change validation rules | `src/types/index.ts` (Zod), see [validation-and-types](../reference/validation-and-types.md) |
| Change build / simulate / encode | `src/core/transaction-builder.ts`, see [transaction-pipeline](../concepts/transaction-pipeline.md) |
| Change encode-vs-execute behavior | `src/utils/finalize-transaction.ts`, see [eoa-execution](../concepts/eoa-execution.md) |
| Change the printed output | `src/utils/display.ts` |

Adding an instruction touches five places; the list is in
[AGENTS.md](../../AGENTS.md#when-editing).

## Toolchain

TypeScript ESM, Node >= 22, pnpm. Deps: `@coral-xyz/anchor`, `@solana/web3.js`,
`@solana/spl-token`, `@metaplex-foundation/umi` + `mpl-token-metadata`, `commander`, `zod`,
`pino`, `bs58`. Scripts: `pnpm bs58` (CLI via tsx), `pnpm create-alt`, `build`, `lint`, `format`,
`type-check`.

> This is a Chainlink **example/template** — unaudited; test on devnet before mainnet.
