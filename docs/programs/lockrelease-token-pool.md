---
type: reference
title: Lockrelease Token Pool
---

# Lockrelease Token Pool

CLI command `lockrelease-token-pool` (alias `lr`) · Source `src/commands/lockrelease/`,
`src/programs/lockrelease-token-pool/`.
Flags and usage: [commands reference](../commands/index.md). Accounts:
[PDA derivation](../concepts/pda-derivation.md). Data bytes: [encoding](../concepts/encoding.md).
Used by: [lockrelease multisig workflow](../workflows/lockrelease-multisig.md).

**Lock-and-release** pool: locks tokens on the source chain, releases (from pool reserves) on the
destination. Unlike burnmint, it needs liquidity held in a pool-owned ATA, managed by a
rebalancer. No mint-authority transfer required.

## Instructions

Supports **all [burnmint-token-pool](burnmint-token-pool.md) instructions** (identical data and
accounts) **plus**:

| CLI `--instruction` | IDL name | Data bytes | Accounts |
| --- | --- | --- | --- |
| `set-rebalancer` | `set_rebalancer` | rebalancer(32) | State[w], Mint, Authority[s] |
| `set-can-accept-liquidity` | `set_can_accept_liquidity` | bool(1) | State[w], Mint, Authority[s] |
| `provide-liquidity` | `provide_liquidity` | amount u64(8) | State[r], TokenProgram, Mint[w], PoolSigner, PoolTokenATA[w], UserTokenATA[w], Authority[s] |
| `withdraw-liquidity` | `withdraw_liquidity` | amount u64(8) | same as provide-liquidity |

Builder: `src/programs/lockrelease-token-pool/instructions.ts`.
Account metas: `src/programs/lockrelease-token-pool/accounts.ts` (adds `derivePoolTokenAccount` ATA).

## Key facts

- Token program is **auto-detected** from the mint (`detectTokenProgramId`,
  [utilities](../reference/utilities.md)); the rebalancer's ATA (UserTokenATA) and the pool's ATA
  (PoolTokenATA, owned by the Pool Signer PDA) are auto-derived.
- **Liquidity setup order** (from the workflow): `set-rebalancer` → `create-token-account` (pool
  reserve ATA; a built-in instruction, no need for the bare `spl-token` CLI) →
  `set-can-accept-liquidity` → `approve` Pool Signer as delegate
  ([spl-token](spl-token.md)) → `provide-liquidity`.
- **`create-token-account`** is shared with burnmint — creates the Pool Signer ATA (token program
  auto-detected, idempotent, `--execute`-capable, see [EOA execution](../concepts/eoa-execution.md)).
- `provide-` / `withdraw-liquidity` authority **must be the configured rebalancer**.
- Same seeds as burnmint (`STATE_SEED` / `POOL_SIGNER_SEED` / chain-config seed strings are
  identical).

See also: [gotchas](../gotchas/index.md), [glossary](../reference/glossary.md).
