---
type: reference
title: Burnmint Token Pool
---

# Burnmint Token Pool

CLI command `burnmint-token-pool` (alias `bm`) · Source `src/commands/burnmint/`,
`src/programs/burnmint-token-pool/`.
Flags and usage: [commands reference](../commands/index.md). Accounts:
[PDA derivation](../concepts/pda-derivation.md). Data bytes: [encoding](../concepts/encoding.md).
Used by: [burnmint production multisig workflow](../workflows/burnmint-production-multisig.md).

**Burn-and-mint** pool: burns tokens on the source chain, mints on the destination. The pool's
mint authority is typically an SPL multisig containing the Pool Signer PDA, so CCIP can mint
autonomously.

## Instructions

| CLI `--instruction` | IDL name (snake) | Data bytes | Accounts |
| --- | --- | --- | --- |
| `initialize-pool` | `initialize` | none | State[w], Mint, Authority[s,w], System, Program, ProgramData, GlobalConfig |
| `create-token-account` | (SPL ATA program) | — | ATA-create for owner = Pool Signer PDA; idempotent; token program auto-detected. `createTokenAccountCommand` (shared) |
| `accept-ownership` | `accept_ownership` | none | State[w], Mint, Authority[s] |
| `transfer-ownership` | `transfer_ownership` | proposedOwner(32) | State[w], Mint, Authority[s] |
| `set-rate-limit-admin` | `set_rate_limit_admin` | mint(32)+newAdmin(32) | State[w], Authority[s,w] |
| `init-chain-remote-config` | `init_chain_remote_config` | selector+mint+Vec\<RemoteAddr\>+tokenAddr+decimals | State[r], ChainConfig[w], Authority[s,w], System |
| `edit-chain-remote-config` | `edit_chain_remote_config` | same as init | State[r], ChainConfig[w], Authority[s,w], System |
| `append-remote-pool-addresses` | `append_remote_pool_addresses` | selector+mint+Vec\<RemoteAddr\> | State[r], ChainConfig[w], Authority[s,w], System |
| `delete-chain-config` | `delete_chain_config` | selector(8)+mint(32) | State[r], ChainConfig[w], Authority[s,w] |
| `set-chain-rate-limit` | `set_chain_rate_limit` | selector + mint + inbound/outbound `{enabled, capacity, rate}` (74 bytes) | State[r], ChainConfig[w], Authority[s,w] |
| `configure-allow-list` | `configure_allow_list` | Vec\<Pubkey\>+bool | State[w], Mint, Authority[s,w], System |
| `remove-from-allow-list` | `remove_from_allow_list` | Vec\<Pubkey\> | State[w], Mint, Authority[s,w], System |
| `get-state` | (read-only) | — | derives State PDA, deserializes ([account deserialization](../reference/account-deserialization.md)) |
| `get-chain-config` | (read-only) | — | derives ChainConfig PDA, deserializes |

Builder: `src/programs/burnmint-token-pool/instructions.ts` (`InstructionBuilder`).
Account metas: `src/programs/burnmint-token-pool/accounts.ts` (`AccountDerivation` +
`BurnmintTokenPoolAccounts`).
Handlers: shared, in `src/commands/shared/*` (dispatch on `programType === 'burnmint-token-pool'`).

### Not exposed on purpose

The program also has `transfer_mint_authority_to_multisig` and
`transfer_mint_authority_to_pda_signer`, which a token issuer cannot use: both require the signer
to be the **pool program's upgrade authority**
(`program_data.upgrade_authority_address == authority`, commented in the Rust as "only allowed by
program upgrade authority as it is a critical operation"). That is whoever deployed the pool
program, not the pool owner or the mint authority. Move a mint authority with
[`spl-token transfer-mint-authority`](spl-token.md) instead.

## Key facts

- Pool **State PDA** seed `["ccip_tokenpool_config", mint]`; **Pool Signer PDA** seed
  `["ccip_tokenpool_signer", mint]` (not in the init-tx accounts — derive separately via
  `utils --instruction derive-accounts`).
- Rate limit amounts are in **smallest local (Solana) token units**.
- `init-chain-remote-config` must run **before** `set-chain-rate-limit`; pool addresses must be
  **empty** at init, then added via `edit-` / `append-`.
- Shared with [lockrelease-token-pool](lockrelease-token-pool.md) — identical for all instructions
  above.

See also: [gotchas](../gotchas/index.md), [glossary](../reference/glossary.md).
