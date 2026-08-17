---
type: index
---

# Command catalog

One page per CLI instruction, generated from `src/commands` (`pnpm docs:catalog`).
Machine-readable: [`catalog.json`](catalog.json). Global flags and invocation shape are in it too.

## burnmint-token-pool (`bm`)

- [`initialize-pool`](burnmint-token-pool/initialize-pool.md) (writes, --execute) - Create the pool State PDA for a mint, making this program the token's burn/mint pool.
- [`create-token-account`](burnmint-token-pool/create-token-account.md) (writes, --execute) - Create the pool's token account: the associated token account owned by the pool signer PDA, where the program holds tokens.
- [`accept-ownership`](burnmint-token-pool/accept-ownership.md) (writes, --execute) - Accept a pending ownership transfer of the pool.
- [`transfer-ownership`](burnmint-token-pool/transfer-ownership.md) (writes, --execute) - Propose a new pool owner.
- [`set-rate-limit-admin`](burnmint-token-pool/set-rate-limit-admin.md) (writes, --execute) - Set the account allowed to change rate limits in addition to the pool owner.
- [`get-state`](burnmint-token-pool/get-state.md) (read-only) - Read and display the pool's State PDA: owner, proposed owner, rate limit admin, router, pool token account, allow list and (lock/release) rebalancer and liquidity flag.
- [`get-chain-config`](burnmint-token-pool/get-chain-config.md) (read-only) - Read and display one remote chain's configuration: remote token address and decimals, remote pool addresses, and both rate limit buckets.
- [`init-chain-remote-config`](burnmint-token-pool/init-chain-remote-config.md) (writes, --execute) - Create the chain config account for one remote chain: its token address, that token's decimals, and an initially empty remote pool list.
- [`edit-chain-remote-config`](burnmint-token-pool/edit-chain-remote-config.md) (writes, --execute) - Replace the whole chain config for one remote chain: remote token, decimals and the full remote pool list.
- [`set-chain-rate-limit`](burnmint-token-pool/set-chain-rate-limit.md) (writes, --execute) - Set the inbound and outbound token-bucket rate limits for one remote chain.
- [`append-remote-pool-addresses`](burnmint-token-pool/append-remote-pool-addresses.md) (writes, --execute) - Add remote pool addresses to an existing chain config, leaving the rest of it untouched.
- [`delete-chain-config`](burnmint-token-pool/delete-chain-config.md) (writes, --execute) - Close the chain config account for one remote chain, refunding its rent to the authority.
- [`configure-allow-list`](burnmint-token-pool/configure-allow-list.md) (writes, --execute) - Enable or disable the allow list and add sender addresses to it.
- [`remove-from-allow-list`](burnmint-token-pool/remove-from-allow-list.md) (writes, --execute) - Remove sender addresses from the allow list.

## lockrelease-token-pool (`lr`)

- [`initialize-pool`](lockrelease-token-pool/initialize-pool.md) (writes, --execute) - Create the pool State PDA for a mint, making this program the token's lock/release pool.
- [`create-token-account`](lockrelease-token-pool/create-token-account.md) (writes, --execute) - Create the pool's token account: the associated token account owned by the pool signer PDA, which holds the locked tokens.
- [`accept-ownership`](lockrelease-token-pool/accept-ownership.md) (writes, --execute) - Accept a pending ownership transfer of the pool.
- [`transfer-ownership`](lockrelease-token-pool/transfer-ownership.md) (writes, --execute) - Propose a new pool owner.
- [`set-rate-limit-admin`](lockrelease-token-pool/set-rate-limit-admin.md) (writes, --execute) - Set the account allowed to change rate limits in addition to the pool owner.
- [`get-state`](lockrelease-token-pool/get-state.md) (read-only) - Read and display the pool's State PDA: owner, proposed owner, rate limit admin, router, pool token account, allow list, rebalancer and the can-accept-liquidity flag.
- [`get-chain-config`](lockrelease-token-pool/get-chain-config.md) (read-only) - Read and display one remote chain's configuration: remote token address and decimals, remote pool addresses, and both rate limit buckets.
- [`init-chain-remote-config`](lockrelease-token-pool/init-chain-remote-config.md) (writes, --execute) - Create the chain config account for one remote chain: its token address, that token's decimals, and an initially empty remote pool list.
- [`edit-chain-remote-config`](lockrelease-token-pool/edit-chain-remote-config.md) (writes, --execute) - Replace the whole chain config for one remote chain: remote token, decimals and the full remote pool list.
- [`set-chain-rate-limit`](lockrelease-token-pool/set-chain-rate-limit.md) (writes, --execute) - Set the inbound and outbound token-bucket rate limits for one remote chain.
- [`append-remote-pool-addresses`](lockrelease-token-pool/append-remote-pool-addresses.md) (writes, --execute) - Add remote pool addresses to an existing chain config, leaving the rest of it untouched.
- [`delete-chain-config`](lockrelease-token-pool/delete-chain-config.md) (writes, --execute) - Close the chain config account for one remote chain, refunding its rent to the authority.
- [`configure-allow-list`](lockrelease-token-pool/configure-allow-list.md) (writes, --execute) - Enable or disable the allow list and add sender addresses to it.
- [`remove-from-allow-list`](lockrelease-token-pool/remove-from-allow-list.md) (writes, --execute) - Remove sender addresses from the allow list.
- [`provide-liquidity`](lockrelease-token-pool/provide-liquidity.md) (writes, --execute) - Deposit tokens from the rebalancer into the pool's token account, backing release on inbound transfers.
- [`withdraw-liquidity`](lockrelease-token-pool/withdraw-liquidity.md) (writes, --execute) - Withdraw tokens from the pool's token account back to the rebalancer.
- [`set-rebalancer`](lockrelease-token-pool/set-rebalancer.md) (writes, --execute) - Set the account allowed to provide and withdraw pool liquidity.
- [`set-can-accept-liquidity`](lockrelease-token-pool/set-can-accept-liquidity.md) (writes, --execute) - Enable or disable liquidity operations on the pool.

## metaplex (`mpl`)

- [`update-authority`](metaplex/update-authority.md) (writes, --execute) - Validate that Metaplex metadata exists and verify current update authority.

## router (`r`)

- [`owner-propose-administrator`](router/owner-propose-administrator.md) (writes, --execute) - Create the token's admin registry entry and nominate its first administrator (the CCIP-side admin for the token).
- [`owner-override-pending-administrator`](router/owner-override-pending-administrator.md) (writes, --execute) - Overwrite the pending administrator nomination on a registry entry that has not been accepted yet.
- [`accept-admin-role`](router/accept-admin-role.md) (writes, --execute) - Accept a pending administrator nomination for the token, completing registration.
- [`transfer-admin-role`](router/transfer-admin-role.md) (writes, --execute) - Nominate a new administrator for an already-owned registry entry.
- [`set-pool`](router/set-pool.md) (writes, --execute) - Point the token's registry entry at its pool by registering the address lookup table, activating the token for cross-chain transfers.
- [`create-lookup-table`](router/create-lookup-table.md) (writes, --execute) - Create the address lookup table for a token and populate it with the canonical CCIP accounts.
- [`append-to-lookup-table`](router/append-to-lookup-table.md) (writes, --execute) - Append further addresses to an existing lookup table, for example the SPL multisig used as mint authority.
- [`inspect-token`](router/inspect-token.md) (read-only) - Read-only audit of one token: the mint (authority, freeze authority, SPL multisig members, Token-2022 extensions), the pool state and its token account, the pool program global config, the CCIP token admin registry, and the address lookup table.

## spl-token (`spl`)

- [`create-mint`](spl-token/create-mint.md) (writes, --execute) - Create an SPL mint under a seed-derived address, optionally with metadata and an initial supply minted to a recipient.
- [`create-multisig`](spl-token/create-multisig.md) (writes, --execute) - Create an SPL token multisig, typically to hold the mint authority with the pool signer PDA as a member.
- [`mint`](spl-token/mint.md) (writes, --execute) - Mint tokens to a recipient.
- [`transfer-mint-authority`](spl-token/transfer-mint-authority.md) (writes, --execute) - Move the mint authority to a new account, normally an SPL multisig containing the pool signer PDA.
- [`update-metadata-authority`](spl-token/update-metadata-authority.md) (writes, --execute) - Update the metadata update authority of a Token-2022 mint that carries the native TokenMetadata extension.
- [`approve`](spl-token/approve.md) (writes, --execute) - Approve delegate command for SPL Token.

## utils (`u`)

- [`derive-accounts`](utils/derive-accounts.md) (read-only) - Derive and display the PDAs and account addresses for a program and mint without sending anything.

_Generated; edit `docs/commands/_meta.json` for authored context, then regenerate._
