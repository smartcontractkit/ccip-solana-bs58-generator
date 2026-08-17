---
type: workflow
title: BurnMint with SPL Token Multisig (educational — EOA signs, no Squads)
steps:
  - id: evm-deploy
    command: "external: Terminal 2 (Hardhat) — deployToken, deployTokenPool, mintTokens, claimAdmin, acceptAdminRole on Ethereum Sepolia"
    outcome: "ETH_TOKEN_ADDRESS and ETH_POOL_ADDRESS saved to ~/.phase1_vars"
  - id: create-token
    command: "cct-solana-tx spl-token --instruction create-mint --env devnet --authority <ADMIN_WALLET> --decimals 9 --with-metaplex true --name <NAME> --symbol <SYMBOL> --uri <URI> --initial-supply <AMOUNT> --recipient <ADMIN_WALLET> --execute"
    outcome: "SPL mint + Metaplex metadata; mint authority = admin wallet; admin ATA created and funded in the same tx"
  - id: initialize-pool
    command: "cct-solana-tx burnmint-token-pool --instruction initialize-pool --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <ADMIN_WALLET> --execute"
    outcome: "Pool State PDA created; pool owner = admin wallet"
  - id: verify-pool
    command: "cct-solana-tx utils --instruction derive-accounts --env devnet --program-type burnmint-token-pool --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT>"
    outcome: "SOL_POOL_SIGNER_PDA and SOL_POOL_CONFIG_PDA recorded (read-only; no --execute)"
  - id: create-pool-token-account
    command: "cct-solana-tx burnmint-token-pool --instruction create-token-account --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <ADMIN_WALLET> --execute"
    outcome: "Pool Signer ATA exists — the account the pool uses during transfers (idempotent)"
  - id: propose-administrator
    command: "cct-solana-tx router --instruction owner-propose-administrator --env devnet --program-id <ROUTER_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <ADMIN_WALLET> --token-admin-registry-admin <ADMIN_WALLET> --execute"
    outcome: "Admin wallet = pending CCIP admin (must run while the wallet still holds mint authority)"
  - id: accept-admin-role
    command: "cct-solana-tx router --instruction accept-admin-role --env devnet --program-id <ROUTER_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <ADMIN_WALLET> --execute"
    outcome: "Admin wallet = active CCIP admin"
  - id: create-multisig
    command: "cct-solana-tx spl-token --instruction create-multisig --env devnet --authority <ADMIN_WALLET> --mint <SOL_TOKEN_MINT> --seed <UNIQUE_SEED> --signers '[\"<SOL_POOL_SIGNER_PDA>\", \"<ADMIN_WALLET>\"]' --threshold 1 --execute"
    outcome: "1-of-2 SPL multisig exists — record SOL_MULTISIG_ADDRESS (--mint selects the token program, --seed derives the address; both mandatory)"
  - id: transfer-mint-authority
    command: "cct-solana-tx spl-token --instruction transfer-mint-authority --env devnet --authority <ADMIN_WALLET> --mint <SOL_TOKEN_MINT> --new-mint-authority <SOL_MULTISIG_ADDRESS> --execute"
    outcome: "Mint authority = SPL multisig"
  - id: verify-multisig
    command: "spl-token display <SOL_TOKEN_MINT>"
    outcome: "Mint authority reads back as SOL_MULTISIG_ADDRESS"
  - id: init-chain-remote-config
    command: "cct-solana-tx burnmint-token-pool --instruction init-chain-remote-config --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <ADMIN_WALLET> --remote-chain-selector 16015286601757825753 --token-address <ETH_TOKEN_ADDRESS> --decimals 18 --pool-addresses '[]' --execute"
    outcome: "Sepolia chain config PDA created with an empty pool address list"
  - id: edit-chain-remote-config
    command: "cct-solana-tx burnmint-token-pool --instruction edit-chain-remote-config --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <ADMIN_WALLET> --remote-chain-selector 16015286601757825753 --token-address <ETH_TOKEN_ADDRESS> --decimals 18 --pool-addresses '[\"<ETH_POOL_ADDRESS>\"]' --execute"
    outcome: "Ethereum remote pool address recorded on the chain config"
  - id: evm-chain-config
    command: "external: Terminal 2 (Hardhat) — applyChainUpdates pointing the ETH pool at the Solana Pool Config PDA + token"
    outcome: "Ethereum → Solana lane configured"
  - id: evm-set-pool
    command: "external: Terminal 2 (Hardhat) — setPool linking token → pool in TokenAdminRegistry"
    outcome: "Ethereum side registered"
  - id: create-lookup-table
    command: "cct-solana-tx router --instruction create-lookup-table --env devnet --program-id <ROUTER_PROGRAM> --authority <ADMIN_WALLET> --mint <SOL_TOKEN_MINT> --pool-program-id <POOL_PROGRAM> --fee-quoter-program-id <FEE_QUOTER_PROGRAM> --additional-addresses '[\"<SOL_MULTISIG_ADDRESS>\"]' --execute"
    outcome: "CCIP ALT created (or use pnpm create-alt then append-to-lookup-table)"
  - id: set-pool
    command: "cct-solana-tx router --instruction set-pool --env devnet --program-id <ROUTER_PROGRAM> --authority <ADMIN_WALLET> --mint <SOL_TOKEN_MINT> --pool-lookup-table <ALT_ADDRESS> --writable-indexes '[3,4,7]' --execute"
    outcome: "Solana token linked to the ALT in the Token Admin Registry"
  - id: pre-transfer-delegate
    command: "cct-solana-tx spl-token --instruction approve --env devnet --authority <ADMIN_WALLET> --mint <SOL_TOKEN_MINT> --delegate <CCIP_FEE_BILLING_SIGNER> --amount 18446744073709551615 --execute"
    outcome: "Admin ATA delegated to the router fee-billing signer PDA (seed \"fee_billing_signer\") so CCIP can pull tokens on send"
  - id: test-transfers
    command: "external: ccip-cli send (Solana → Ethereum from Terminal 1, Ethereum → Solana from Terminal 2), then ccip-cli show <id> --wait"
    outcome: "Both directions succeed on CCIP Explorer"
---
# BurnMint with SPL Token Multisig

The simplified sibling of [burnmint-production-multisig](burnmint-production-multisig.md): a single
1-of-2 SPL token multisig holds the mint authority, with the Pool Signer PDA and one admin wallet as
members. There is no Squads layer, so every state-changing command is signed locally with
`--execute` instead of printing Base58 for a multisig to import. It teaches the mint-authority
arrangement; it is not a production governance model.

The full walkthrough is the Chainlink tutorial:
<https://docs.chain.link/ccip/tutorials/svm/cross-chain-tokens/spl-token-multisig-tutorial>
It is the source of truth for prerequisites, the EVM side, and transfer testing.

## What differs from the production flow

The on-chain instructions are the same. Only the signing mode and the governance shape change:

| | Here | [Production](burnmint-production-multisig.md) |
| --- | --- | --- |
| Signing | `--execute --keypair`, the wallet signs and sends | Base58 output imported into Squads |
| `--authority` | the admin wallet | the Squads vault |
| Mint authority | 1-of-2 SPL multisig (Pool Signer PDA + admin wallet) | same, but the human member is the Squads vault |
| CCIP governance | the admin wallet directly | the Squads multisig |

An SPL multisig can only execute SPL token instructions, never CCIP or pool governance - which is
why the production flow adds a Squads layer rather than reusing this one
([more](../gotchas/index.md#mint-authority-multisig)).

## Solana steps

The ordered commands and their outcomes are the `steps:` block in this page's front matter.

`--env devnet`, `--authority <ADMIN_WALLET>`, and `--execute` on every state-changing command.
Read-only commands (`derive-accounts`, `get-state`, `get-chain-config`) reject `--execute`.

## Ordering constraints

**Complete CCIP registration before creating the multisig.** `owner-propose-administrator` requires
the signer to be the mint authority, and an SPL multisig cannot execute CCIP instructions - so if
the mint authority moves first, self-service registration is no longer possible.

## Related

[EOA execution](../concepts/eoa-execution.md) (what `--execute` does) ·
[transaction pipeline](../concepts/transaction-pipeline.md) · [commands](../commands/index.md) ·
[gotchas](../gotchas/index.md)
