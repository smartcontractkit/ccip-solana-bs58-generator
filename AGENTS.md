# AGENTS.md

Entry point for AI coding agents and humans. Depth lives under [`docs/`](docs/index.md). Keep
answers grounded in these files and the source.

## Where to look

| If the task is… | Go to |
| --- | --- |
| "which command/flag does X?" | [`docs/commands/catalog.json`](docs/commands/catalog.json) — every instruction, flag, and safety fact |
| "run a full multisig flow end to end" | [workflows](docs/workflows/index.md) — ordered, machine-readable `steps:` per flow |
| "why did this fail / is this safe to upload?" | [gotchas](docs/gotchas/index.md), then [the simulation gate](docs/decisions/simulation-gate.md) |
| "what address is this / derive a PDA" | [PDA derivation](docs/concepts/pda-derivation.md) |
| "what bytes does this instruction produce?" | [encoding](docs/concepts/encoding.md) |
| "how does the tool build/simulate/print?" | [transaction pipeline](docs/concepts/transaction-pipeline.md) |
| "change or add an instruction" | [the source map](#source-map) and [when editing](#when-editing) below |

These pages are generated from or checked against the source. Full map: [`docs/index.md`](docs/index.md).

## What this repository is

A CLI (`cct-solana-tx`) that builds, simulates, and **Base58-encodes** Solana CCIP token-pool admin
transactions for execution via a **Squads multisig**. It does not sign or send; the exceptions are
the global `--execute` flag (EOA sign-and-send for supported instructions) and `scripts/create-alt.ts`.
Stack: TypeScript ESM, Node >= 22, pnpm, `@coral-xyz/anchor`, `@solana/web3.js`, commander, zod, pino.

> ⚠️ Chainlink **example/template** — unaudited. Test on devnet.

## Setup and quality commands

```bash
pnpm install
pnpm build         # tsc
pnpm type-check    # tsc --noEmit
pnpm lint          # eslint src
pnpm format        # prettier --check
pnpm docs:gate     # command-catalog freshness + docs links/anchors
```

## Installing and running the CLI

Users install the prebuilt tarball from a release. Node >= 22 is the only prerequisite and nothing
compiles on their machine:

```bash
npm i -g https://github.com/smartcontractkit/ccip-solana-bs58-generator/releases/download/v<version>/chainlink-ccip-solana-bs58-generator-<version>.tgz
cct-solana-tx --version
cct-solana-tx <program|alias> --instruction <kebab-name> --env devnet [flags]
```

- **Never suggest `npm i -g "git+https://…"`.** It fails on npm 11 with `sh: tsc: command not
  found` - npm prepares git dependencies through a nested install that does not provide the
  compiler, then rolls the install back. A git URL as a project dependency (no `-g`) does work.

- Programs: `burnmint-token-pool` (`bm`), `lockrelease-token-pool` (`lr`), `router` (`r`),
  `spl-token` (`spl`), `metaplex` (`mpl`), `utils` (`u`).
- `--env devnet` or `--rpc-url <url>` is required for transaction commands.
- In a checkout the same CLI runs through tsx as `pnpm bs58 …`, with no build step. `docs/` is
  written for the installed form; there, read `cct-solana-tx` as `pnpm bs58`.
- Other scripts: `pnpm create-alt` (EOA-executed ALT creator).

## Machine-readable output (`--json`)

`--json` puts exactly one JSON document on stdout and moves every other write - banners, progress
lines, logs - to stderr. Use it whenever the output is going into a script, a Makefile, a registry
or an agent; parsing the human output means grepping for something base58-shaped and hoping.

```bash
cct-solana-tx bm --instruction get-state --env devnet --json … | jq .state.config.owner
cct-solana-tx bm --instruction set-rate-limit-admin --env devnet --json … | jq -r .transaction
```

Two envelope shapes, both carrying `ok`, `cliVersion` and `network{env,rpcUrl}`:

- **`kind: "transaction"`** - from every transaction-building command. Holds `transaction` (the blob
  in the requested `--format`), `encodings{base58,base64,hex}`, `accounts[]`, `details`,
  `simulation{success,computeUnits,error}` and `execution{executed,signature,signer,explorerUrl}`.
  Without `--execute`, `execution.executed` is false and `signature` is null.
- **`kind: "pool-state" | "chain-config" | "token-inspection" | "derived-accounts"`** - from the
  read-only commands, carrying on-chain state.

Conventions that callers can rely on:

- **Check `simulation.success` before using a transaction.** A failed simulation still returns an
  envelope, because the caller needs the error. Getting an envelope back is not a signal that the
  transaction is safe to upload. See [the simulation gate](docs/decisions/simulation-gate.md).
- All three encodings are always present, so storing an artifact once is enough - rebuilding to get
  another encoding would produce different bytes, since the blockhash moves.
- Absent values are `null`, never the `"None"` the human display prints.

## Versioning

Deliberately `0.x`, and staying there. This CLI covers Solana CCT operations until `@chainlink/ccip-cli`
does, so its instruction set moves with the on-chain programs and no interface stability is promised.
A `1.0` would claim the opposite.

Under `0.x` the minor carries breaking changes:

- `0.5.0 -> 0.6.0` - a generated transaction's bytes change for the same inputs, or a flag is removed.
- `0.5.0 -> 0.5.1` - new instruction, new flag, fix, docs.

`package.json` `version` is the only place a version is written; `--version`, `docs --json` and the
upstream docs URL all read it. Release tags are `v<version>` and must match it exactly; each release
carries the tarball `npm pack` produced for that tag. Consumers pin a floor (`>= 0.5.0`) and install
one release. `^0.5.0` as an npm range means `>= 0.5.0 < 0.6.0`, narrower than the caret means
elsewhere.

## Finding these docs from an install

`docs/` ships inside the package, so the pages describe the binary that is actually installed:

```bash
cct-solana-tx docs --path     # the docs directory; read it with normal file tools
cct-solana-tx docs --json     # manifest: version, docs path, catalog path, upstream URL
cct-solana-tx docs --list     # every page
cct-solana-tx docs gotchas    # print one page to stdout
```

Call `docs --path` once, then grep and read that directory directly.

## Command catalog

- Machine-readable: [`docs/commands/catalog.json`](docs/commands/catalog.json) — every program and
  instruction with flags and safety facts (`read_only`, `execute_capable`).
- Human pages: [`docs/commands/`](docs/commands/index.md) — one page per instruction, generated from
  the commander source so they cannot drift. Regenerate with `pnpm docs:catalog`; authored context
  lives in `docs/commands/_meta.json`.

## Conventions and guardrails

- **Output is a legacy message** (for the Squads UI import field); a v0 copy is built only to
  simulate. Encoding (`--format base58|base64`) is independent of message version: both emit the
  same legacy message. See [why](docs/decisions/legacy-message.md).
- **Failed simulation ⇒ do NOT upload the transaction to Squads.**
  See [gotchas](docs/gotchas/index.md#failed-simulation-gate).
- `--authority` is the Squads **vault** address, not the multisig address.
- **Mint authority goes to an SPL token multisig that includes the pool signer PDA**, not to the
  PDA directly. Whether the project's vault or wallet is also a member is its own decision, and
  it is permanent (SPL multisigs are immutable).
  See [gotchas](docs/gotchas/index.md#mint-authority-multisig).
- Flags are kebab-case on the CLI, camelCase in code.
- **Encoding invariants:** u64 = little-endian; PublicKey = 32 bytes; `Vec<T>` = u32-LE length
  prefix + elements; Anchor discriminator = `sha256("global:<snake_name>")[0..8]`.
  See [encoding](docs/concepts/encoding.md).
- **PDA seeds:** state `["ccip_tokenpool_config", mint]` ·
  chainConfig `["ccip_tokenpool_chainconfig", u64LE(selector), mint]` ·
  signer `["ccip_tokenpool_signer", mint]`. See [PDA derivation](docs/concepts/pda-derivation.md).
- Manual byte (de)serialization must stay in sync with the on-chain Rust program; there is **no
  IDL-driven coder** for args/accounts. See [why](docs/decisions/manual-encoding.md).

## Source map

| Path | Role |
| --- | --- |
| `src/index.ts` | CLI bootstrap, global opts (`--env`, `--rpc-url`, `--execute`, `--keypair`, `--format`), env/RPC resolution |
| `src/commands/<prog>/index.ts` | flags + per-instruction validation + `--instruction` routing. Directory names are short here (`burnmint/`, `lockrelease/`, `router/`, `spl-token/`, `metaplex/`, `utils/`) while `src/programs/` uses the long names (`burnmint-token-pool/`, `lockrelease-token-pool/`) |
| `src/commands/shared/*.ts` | handlers shared by both pool programs |
| `src/programs/<prog>/instructions.ts` | `InstructionBuilder` (instruction data bytes) |
| `src/programs/<prog>/accounts.ts` | `AccountDerivation` (PDAs) + account-meta builders |
| `src/core/transaction-builder.ts` | compile legacy message, simulate, bs58/hex encode |
| `src/utils/*` | anchor, accounts, addresses, alt, constants, token, validation, display, logger, explorer, transaction-executor |
| `src/types/*` | Zod schemas, `Idl`, `PROGRAM_REGISTRY` |
| `scripts/create-alt.ts` | standalone EOA-executed ALT creator |

## When editing

- Adding an instruction touches five places:
  1. `src/commands/<prog>/<instruction>.ts` — the handler.
  2. `src/commands/<prog>/index.ts` — import and route the handler, add its flags and validation,
     and list it in the `--instruction` description (the catalog is generated from that list).
  3. `src/programs/<prog>/instructions.ts` — the instruction data bytes.
  4. `src/programs/<prog>/accounts.ts` — the account metas.
  5. `src/types/index.ts` — a Zod schema for the args.
- After changing any command or flag, run `pnpm docs:catalog` and commit the regenerated
  `docs/commands/`; `pnpm docs:gate` fails otherwise.

## Code style

- **No inline `import(...)` type references** mid-code (e.g. `foo?: import('@solana/web3.js').Keypair`).
  Always a top-of-file `import` (use `import type { … }` for type-only imports).

