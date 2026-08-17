---
type: reference
title: Account Deserialization (read-only commands)
---

# Account Deserialization (read-only commands)

`get-state` and `get-chain-config` don't build transactions — they read on-chain accounts and
hand-parse the bytes (no `--authority` needed). The parsers mirror the on-chain Rust struct layouts
and must stay in sync with the program.
Source: `src/commands/shared/get-state.ts`, `src/commands/shared/get-chain-config.ts`,
`src/programs/shared/pool-state.ts`.
Related: [encoding](../concepts/encoding.md), [PDA derivation](../concepts/pda-derivation.md).

## Flow

```
validate(programId, mint [, selector]) → derive PDA → connection.getAccountInfo(pda)
  → manual deserialize (skip 8-byte discriminator) → pretty print
```

## get-state: Pool State account

Derives the State PDA (`["ccip_tokenpool_config", mint]`), fetches it, then deserializes via
`deserializePoolState(data)` in `src/programs/shared/pool-state.ts` (shared with the router's
`inspect-token`). Layout, in byte order after skipping the 8-byte Anchor account discriminator:

1. `version` (u8)
2. `tokenProgram` (32) · `mint` (32) · `decimals` (u8) · `poolSigner` (32) · `poolTokenAccount` (32)
3. `owner` (32) · `proposedOwner` (32) · `rateLimitAdmin` (32) · `routerOnrampAuthority` (32) · `router` (32)
4. `rebalancer` (32) · `canAcceptLiquidity` (bool u8)
5. `listEnabled` (bool u8) · `allowList` as `Vec<PublicKey>` (u32 LE count prefix + N x 32)
6. `rmnRemote` (32)

The layout is shared by burnmint and lockrelease pools; the `rebalancer` / `canAcceptLiquidity`
bytes are always parsed, but the display only shows them for lockrelease.
`displayStateAccount()` prints program info, token config, pool accounts, governance, config, and
allow list (truncated if long).

## get-chain-config: Chain Config account

Fetches the Chain Config PDA (`["ccip_tokenpool_chainconfig", u64LE(selector), mint]`) and the mint
account (local `decimals` read at byte offset 44, valid for both SPL Token and Token-2022).
`deserializeChainConfigAccount(data)`, after the 8-byte discriminator:

- pool addresses as `Vec<RemoteAddress>` — each `RemoteAddress` = u32 LE len + `len` bytes
  (hex-encoded for display)
- remote token address (`RemoteAddress`) + remote `decimals` (u8)
- inbound then outbound token-bucket rate limits, each in this field order:
  `tokens` (u64, current level), `lastUpdated` (u64 timestamp), `enabled` (bool u8),
  `capacity` (u64), `rate` (u64)

`displayChainConfig()` shows local token (mint + decimals), remote token (hex + decimals + pool
addresses), and both rate limits via `formatTokenAmount(amount, decimals)` (= `amount / 10^decimals`)
plus a UTC timestamp. Rate limits are always expressed in local (Solana-side) token units.

These manual parsers are the counterpart of the manual encoders in
[encoding](../concepts/encoding.md); the Anchor coder is not used in either direction. The router's
registry parser is documented in [router](../programs/router.md).

See also: [burnmint-token-pool](../programs/burnmint-token-pool.md),
[lockrelease-token-pool](../programs/lockrelease-token-pool.md), [glossary](glossary.md).
