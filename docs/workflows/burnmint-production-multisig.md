---
type: workflow
title: BurnMint with Production Multisig Governance (Squads + SPL multisig)
steps:
  - id: evm-deploy
    command: "external: Terminal 2 (Hardhat) — deploy ERC20 + CCIP BurnMint pool on Ethereum Sepolia, claim + accept CCIP admin"
    outcome: "ETH_TOKEN_ADDRESS and ETH_POOL_ADDRESS recorded"
  - id: create-mint
    command: "cct-solana-tx spl-token --instruction create-mint --env devnet --authority <SQUAD_VAULT> --with-metaplex true --decimals 9 --name <NAME> --symbol <SYMBOL> --uri <URI> --initial-supply <AMOUNT> --recipient <SQUAD_VAULT>"
    outcome: "New SPL mint exists; mint authority = Squad vault; vault ATA holds the initial supply"
  - id: initialize-pool
    command: "cct-solana-tx burnmint-token-pool --instruction initialize-pool --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <SQUAD_VAULT>"
    outcome: "Pool State PDA created with owner = Squad vault (account #1 of the tx = SOL_POOL_ADDRESS)"
  - id: derive-accounts
    command: "cct-solana-tx utils --instruction derive-accounts --env devnet --program-type burnmint-token-pool --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT>"
    outcome: "Pool Signer PDA (and other PDAs) printed — record SOL_POOL_SIGNER_PDA. initialize-pool does not return it, and the SPL multisig needs it"
  - id: create-token-account
    command: "cct-solana-tx burnmint-token-pool --instruction create-token-account --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <SQUAD_VAULT>"
    outcome: "Pool token account (the pool signer's ATA) exists; idempotent. Both the on-ramp and the off-ramp require it and neither creates it"
  - id: owner-propose-administrator
    command: "cct-solana-tx router --instruction owner-propose-administrator --env devnet --program-id <ROUTER_PROGRAM> --authority <SQUAD_VAULT> --mint <SOL_TOKEN_MINT> --token-admin-registry-admin <SQUAD_VAULT>"
    outcome: "Token Admin Registry PDA created; Squad vault = pending administrator"
  - id: accept-admin-role
    command: "cct-solana-tx router --instruction accept-admin-role --env devnet --program-id <ROUTER_PROGRAM> --authority <SQUAD_VAULT> --mint <SOL_TOKEN_MINT>"
    outcome: "Squad vault is the active CCIP administrator for the token"
  - id: create-multisig
    command: "cct-solana-tx spl-token --instruction create-multisig --env devnet --authority <SQUAD_VAULT> --mint <SOL_TOKEN_MINT> --seed <UNIQUE_SEED> --signers '[\"<SOL_POOL_SIGNER_PDA>\", \"<SQUAD_VAULT>\"]' --threshold 1"
    outcome: "Layer-2 SPL token multisig exists (Pool Signer PDA + vault, 1-of-2) — record SOL_MULTISIG_ADDRESS"
  - id: transfer-mint-authority
    command: "cct-solana-tx spl-token --instruction transfer-mint-authority --env devnet --authority <SQUAD_VAULT> --mint <SOL_TOKEN_MINT> --new-mint-authority <SOL_MULTISIG_ADDRESS>"
    outcome: "Mint authority = SPL multisig; vault no longer holds it directly (reversible only by a multisig-signed SetAuthority)"
  - id: mint-through-multisig
    command: "external: Squads vaultTransactionCreate wrapping an SPL MintTo whose authority is <SOL_MULTISIG_ADDRESS> and whose signing member is <SQUAD_VAULT>, then proposalCreate + approve + vaultTransactionExecute"
    outcome: "Tokens minted with the vault signing as a member of the SPL multisig — this CLI cannot emit this transaction"
  - id: init-chain-remote-config
    command: "cct-solana-tx burnmint-token-pool --instruction init-chain-remote-config --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <SQUAD_VAULT> --remote-chain-selector 16015286601757825753 --token-address <ETH_TOKEN_ADDRESS> --decimals 18 --pool-addresses '[]'"
    outcome: "Chain Remote Config PDA for Sepolia created (empty pool addresses)"
  - id: edit-chain-remote-config
    command: "cct-solana-tx burnmint-token-pool --instruction edit-chain-remote-config --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <SQUAD_VAULT> --remote-chain-selector 16015286601757825753 --token-address <ETH_TOKEN_ADDRESS> --decimals 18 --pool-addresses '[\"<ETH_POOL_ADDRESS>\"]'"
    outcome: "Ethereum remote pool address stored in the chain config"
  - id: set-chain-rate-limit
    command: "cct-solana-tx burnmint-token-pool --instruction set-chain-rate-limit --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <SQUAD_VAULT> --remote-chain-selector 16015286601757825753 --inbound-enabled true --inbound-capacity <CAP> --inbound-rate <RATE> --outbound-enabled true --outbound-capacity <CAP> --outbound-rate <RATE>"
    outcome: "Token-bucket rate limits active for the Sepolia lane (optional step)"
  - id: create-lookup-table
    command: "cct-solana-tx router --instruction create-lookup-table --env devnet --program-id <ROUTER_PROGRAM> --authority <SQUAD_VAULT> --mint <SOL_TOKEN_MINT> --pool-program-id <POOL_PROGRAM> --fee-quoter-program-id <FEE_QUOTER_PROGRAM> --additional-addresses '[\"<SOL_MULTISIG_ADDRESS>\"]'"
    outcome: "CCIP ALT created with the 10 required accounts + the SPL multisig (execute in Squads within ~60-90s, or fall back to pnpm create-alt + append-to-lookup-table)"
  - id: set-pool
    command: "cct-solana-tx router --instruction set-pool --env devnet --program-id <ROUTER_PROGRAM> --authority <SQUAD_VAULT> --mint <SOL_TOKEN_MINT> --pool-lookup-table <ALT_ADDRESS> --writable-indexes '[3,4,7]'"
    outcome: "Pool registered with the router; token is CCIP-enabled on Solana"
  - id: evm-apply-chain-updates
    command: "external: Terminal 2 (Hardhat) — applyChainUpdates + setPool pointing the Sepolia pool at Solana"
    outcome: "Sepolia lane configured; cross-chain transfers can be tested with ccip-cli"
  - id: pre-transfer-delegate
    command: "cct-solana-tx spl-token --instruction approve --env devnet --authority <SENDER_WALLET> --mint <SOL_TOKEN_MINT> --delegate <CCIP_FEE_BILLING_SIGNER> --amount 18446744073709551615 --execute"
    outcome: "Sending wallet's ATA is delegated to the router fee-billing signer PDA (seed \"fee_billing_signer\"), which CCIP needs to pull tokens on send"
---
# BurnMint with Production Multisig Governance

Dual-layer governance for a Burn & Mint token on Solana: a **Squads multisig** owns CCIP
administration and the pool, and a **SPL token multisig** holds the mint authority with the Pool
Signer PDA as a member so CCIP can mint autonomously. This repo covers the Solana side only, and
prints a Base58 transaction to import into Squads (*Developers -> TX Builder -> Import base58
encoded tx*).

The full walkthrough is the Chainlink tutorial:
<https://docs.chain.link/ccip/tutorials/svm/cross-chain-tokens/production-multisig-tutorial>
It is the source of truth for prerequisites, the EVM/Hardhat side, and the transfer testing.

## Solana steps

The ordered commands and their outcomes are the `steps:` block in this page's front matter.

`--env devnet` and `--authority <SQUAD_VAULT>` throughout. `--authority` is always the vault, never
the multisig account ([why](../gotchas/index.md#authority-is-the-vault)). The one exception is
`pre-transfer-delegate`, which the sending wallet runs itself with `--execute` rather than through
Squads.

## Ordering constraints

Enforced on chain:

- **Create the pool token account before the first transfer.** Burnmint's on-ramp and off-ramp both
  take `pool_token_account` with a fixed address constraint and no `init_if_needed`
  (`burnmint-token-pool/src/context.rs`), so a lane whose pool ATA does not exist fails on the first
  transfer even though every governance step succeeded. `create-token-account` is idempotent.

- **Initialize the pool and finish CCIP registration while the vault still holds the mint
  authority.** `owner-propose-administrator` requires the signer to be the mint authority
  (`ccip-router` `token_context.rs`, `address = mint.mint_authority.unwrap()`), and an SPL multisig
  cannot execute CCIP instructions - so moving the mint authority first blocks registration.
- `create-lookup-table` derives the ALT address from a **recent slot**, so it must be imported and
  executed in Squads within roughly 60-90 seconds. Otherwise use `pnpm create-alt` (EOA-signed,
  immediate, empty) followed by `append-to-lookup-table`.
- Minting *as the vault* through the SPL multisig is not expressible through this CLI - it needs a
  Squads vault transaction wrapping the SPL `MintTo`
  ([why](../gotchas/index.md#vault-mint-needs-squads-tx)). A member that is a plain keypair mints
  with `spl-token --instruction mint --multisig <ms> --multisig-signers '["<member>"]' --execute`.

## Related

[transaction pipeline](../concepts/transaction-pipeline.md) (never upload a failed simulation) ·
[PDA derivation](../concepts/pda-derivation.md) · [commands](../commands/index.md) ·
[gotchas](../gotchas/index.md) · programs: [burnmint-token-pool](../programs/burnmint-token-pool.md),
[router](../programs/router.md), [spl-token](../programs/spl-token.md)
