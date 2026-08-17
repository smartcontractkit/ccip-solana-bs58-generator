---
type: index
---

# Documentation

Entry points: [README](../README.md) for humans, [AGENTS.md](../AGENTS.md) for agents.

Each fact has one owning page. A few values (PDA seeds, the discriminator formula, the writable
indexes) are repeated in the router and glossary; `pnpm docs:gate` pins every copy to one spelling.

## Command catalog

- [`docs/commands/`](commands/index.md) — one page per CLI instruction: flags, safety facts,
  invocation. Generated from `src/commands` so it cannot drift (`pnpm docs:catalog`).
- [`docs/commands/catalog.json`](commands/catalog.json) — the machine-readable index for agents.

## Concepts

- [Architecture](concepts/architecture.md) — the layers and where to change what.
- [Transaction pipeline](concepts/transaction-pipeline.md) — build, simulate, encode, print.
- [PDA derivation](concepts/pda-derivation.md) — seeds, account order, and flags.
- [Encoding](concepts/encoding.md) — instruction data bytes, discriminators, Borsh invariants.
- [EOA execution](concepts/eoa-execution.md) — `--execute` sign-and-send vs encode-only.

## Reference

- [Validation and types](reference/validation-and-types.md) — Zod schemas and arg coercion.
- [Account deserialization](reference/account-deserialization.md) — read-only `get-state` /
  `get-chain-config` parsing.
- [Utilities](reference/utilities.md) — token detection, hex, ALT, executor, logger.
- [Glossary](reference/glossary.md).
- Programs: [burnmint-token-pool](programs/burnmint-token-pool.md) ·
  [lockrelease-token-pool](programs/lockrelease-token-pool.md) · [router](programs/router.md) ·
  [spl-token](programs/spl-token.md) (non-Anchor) · [metaplex](programs/metaplex.md) (non-Anchor).

## Workflows

This repo is Terminal 1 of the Chainlink CCT flow. See the [workflows index](workflows/index.md):

- [BurnMint production multisig](workflows/burnmint-production-multisig.md) — dual-layer governance
  (Squads + SPL multisig).
- [LockRelease multisig](workflows/lockrelease-multisig.md) — Squads owner+rebalancer, liquidity.
- [BurnMint SPL-token multisig](workflows/burnmint-spl-token-multisig.md) — educational 1-of-2;
  same repo and instructions as the production flow, but signed with `--execute` instead of Squads.

## Gotchas and rationale

- [Gotchas](gotchas/index.md) — facts that bite, each under a stable anchor other pages link to.
- Why it is built this way: [the legacy message](decisions/legacy-message.md) ·
  [hand-written encoding](decisions/manual-encoding.md) ·
  [the simulation gate](decisions/simulation-gate.md).
