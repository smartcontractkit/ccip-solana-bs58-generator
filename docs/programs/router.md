---
type: reference
title: Router
---

# Router

CLI command `router` (alias `r`) · Source `src/commands/router/`, `src/programs/router/`.
Flags and usage: [commands reference](../commands/index.md). Accounts:
[PDA derivation](../concepts/pda-derivation.md). Data bytes: [encoding](../concepts/encoding.md).

CCIP Router operations: **token admin registry** lifecycle, **pool registration** (`set_pool`),
and **Address Lookup Table** management. The `config` and `token_admin_registry` PDAs are
auto-derived.

## Instructions

| CLI `--instruction` | IDL name | Data | Accounts |
| --- | --- | --- | --- |
| `owner-propose-administrator` | `owner_propose_administrator` | admin(32) | Config, TokenAdminRegistry[w], Mint, Authority[s,w], System |
| `owner-override-pending-administrator` | `owner_override_pending_administrator` | admin(32) | same as propose |
| `accept-admin-role` | `accept_admin_role_token_admin_registry` | none | Config, TokenAdminRegistry[w], Mint, Authority[s,w] |
| `transfer-admin-role` | `transfer_admin_role_token_admin_registry` | newAdmin(32) | Config, TokenAdminRegistry[w], Mint, Authority[s,w] |
| `set-pool` | `set_pool` | Vec\<u8\> writable indexes | Config, TokenAdminRegistry[w], Mint, PoolLookupTable, Authority[s,w] |
| `create-lookup-table` | (ALT program) | — | builds create+extend via `buildCreateAndExtendAlt` |
| `append-to-lookup-table` | (ALT program) | — | builds extend via `buildAppendToAlt` |
| `inspect-token` | (read-only) | — | audits registry + pool + mint authority + ALT; `inspectTokenCommand` |

Builder: `src/programs/router/instructions.ts`. Handlers in `src/commands/router/*`.

## inspect-token (read-only auditor)

Reads, for a mint: the **Token Admin Registry** (decoded by byte offset in
`src/programs/router/registry.ts` — the IDL lacks this account type; `writable_indexes` is an
MSB-first `[u128; 2]` bitmap where account index `i` sits at bit `127 - i` of its word, word 0 for
indexes 0-127, word 1 for 128-255), the **pool state** (reuses
`src/programs/shared/pool-state.ts`, see
[account deserialization](../reference/account-deserialization.md)), the **mint authority** plus
SPL multisig members (`readMint` / `readMultisigIfAny` in `src/utils/token.ts`), and the **ALT**
(entries labeled via `deriveCcipBaseAddresses` when `--fee-quoter-program-id` is given).

Args: `--program-id` (router), `--mint`, `--pool-program-id`, optional `--fee-quoter-program-id`.
Rejects `--execute`; no `--authority`. Self-validates the registry layout by checking that the
decoded mint equals the input mint.

## Address Lookup Tables (ALT)

ALTs compress per-tx account lists (32-byte address → 1-byte index). Two ways to manage them:

- **`pnpm create-alt`** (`scripts/create-alt.ts`) — standalone, **EOA-executed immediately**. The
  ALT address is derived from `[authority, recentSlot_LE]`, so it is slot-dependent and must be
  created on the spot. Use this to create an **empty** ALT owned by the Squads vault.
- **`router --instruction create-lookup-table`** — generates an encoded create+extend tx for
  Squads. Warning: the ALT address is slot-derived, so the tx must be imported AND executed while
  `recentSlot` is still in the `SlotHashes` sysvar - 512 slots, ~3.5 minutes. Treat it as
  immediate. For multisig flows, prefer the
  two-step approach: `pnpm create-alt` (empty, now) → `append-to-lookup-table` via Squads.
- **`router --instruction append-to-lookup-table`** — extends an existing ALT. Two modes:
  (a) CCIP auto-derivation (pass `--program-id --fee-quoter-program-id --pool-program-id --mint`;
  `deriveCcipBaseAddresses` adds the 10 base addresses) and/or (b) manual `--additional-addresses`.

The deterministic **10 base addresses** (order matters for `set-pool` writable indexes) and the
chunk-of-30 / cap-256 extend logic live in `src/utils/alt.ts`
([utilities](../reference/utilities.md)).

## set-pool writable indexes

`--writable-indexes` is a `Vec<u8>` of **ALT indices** that need write access during CCIP ops. In
the [workflows](../workflows/burnmint-production-multisig.md) these are `[3,4,7]` = Pool State PDA,
Pool Token ATA, Token Mint (the accounts mutated during mint/burn). Index order is fixed by the ALT
contents above.

See also: [gotchas](../gotchas/index.md), [glossary](../reference/glossary.md).
