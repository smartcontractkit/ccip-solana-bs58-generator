---
type: reference
title: Glossary
---

# Glossary

| Term | Meaning |
| --- | --- |
| **CCIP** | Chainlink Cross-Chain Interoperability Protocol. |
| **CCT** | Cross-Chain Token — the integration pattern the [workflows](../workflows/burnmint-production-multisig.md) implement. |
| **Base58 / bs58** | Default encoding of the serialized legacy tx; the copy-paste output for Squads (Base64 available via `--format base64`). |
| **Squads** | Solana multisig used to approve/execute the generated transactions. The **vault** address (not the multisig address) is the authority/funds account. |
| **SPL multisig** | Native SPL Token multisig — can sign **only** SPL token instructions. Used as mint authority in the [burnmint workflow](../workflows/burnmint-production-multisig.md). |
| **PDA** | Program Derived Address — deterministic account from seeds + program id. See [PDA derivation](../concepts/pda-derivation.md). |
| **Pool State PDA** | Per-mint pool config account (`["ccip_tokenpool_config", mint]`). |
| **Pool Signer PDA** | Per-mint signing authority for autonomous mint/burn/liquidity (`["ccip_tokenpool_signer", mint]`). Not in init-tx accounts. |
| **Chain Config PDA** | Per-(mint, remote chain) config + rate limits (`["ccip_tokenpool_chainconfig", u64LE(selector), mint]`). |
| **Token Admin Registry** | Router PDA recording a token's CCIP admin + pool (`["token_admin_registry", mint]`). See [router](../programs/router.md). |
| **ALT** | Address Lookup Table — compresses tx account lists (32-byte addr → 1-byte index). See [router](../programs/router.md). |
| **Rebalancer** | [LockRelease](../programs/lockrelease-token-pool.md) role authorized to provide/withdraw pool liquidity. |
| **Rate limit / token bucket** | Per-direction `capacity` + refill `rate` (smallest token units). |
| **Chain selector** | u64 id of a remote chain (Sepolia = `16015286601757825753`). |
| **Discriminator** | Anchor's 8-byte `sha256("global:<snake_name>")[0..8]` instruction prefix. See [encoding](../concepts/encoding.md). |
| **Borsh** | Serialization scheme (LE ints, u32-length-prefixed vecs) used for instruction data. |
| **BurnMint vs LockRelease** | Burn-on-source/mint-on-dest vs lock-on-source/release-from-reserves. |
| **RMN** | Risk Management Network — its remote program is recorded as `rmnRemote` in each pool's State config. |
| **Token-2022** | The newer SPL token program; auto-detected from the mint owner (see [utilities](utilities.md)). |
| **EOA execution** | `--execute` mode: sign and send locally with a keypair instead of encoding for Squads. See [EOA execution](../concepts/eoa-execution.md). |
