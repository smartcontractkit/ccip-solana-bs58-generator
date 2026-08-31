---
type: workflow
title: LockRelease Pool with Squads Governance
steps:
  - id: evm-deploy
    command: "external: Terminal 2 (Hardhat) — deploy ERC20 + CCIP BurnMint pool on Ethereum Sepolia, claim + accept CCIP admin"
    outcome: "ETH_TOKEN_ADDRESS and ETH_POOL_ADDRESS recorded"
  - id: create-mint
    command: "cct-solana-tx spl-token --instruction create-mint --env devnet --authority <SQUAD_VAULT> --with-metaplex true --decimals 9 --name <NAME> --symbol <SYMBOL> --uri <URI> --initial-supply <AMOUNT> --recipient <SQUAD_VAULT>"
    outcome: "SPL mint exists; mint authority = Squad vault; vault ATA created and funded in the same tx"
  - id: initialize-pool
    command: "cct-solana-tx lockrelease-token-pool --instruction initialize-pool --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <SQUAD_VAULT>"
    outcome: "Pool State PDA created with owner = Squad vault"
  - id: derive-accounts
    command: "cct-solana-tx utils --instruction derive-accounts --env devnet --program-type lockrelease-token-pool --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT>"
    outcome: "Pool Signer PDA (and other PDAs) printed — record SOL_POOL_SIGNER_PDA"
  - id: owner-propose-administrator
    command: "cct-solana-tx router --instruction owner-propose-administrator --env devnet --program-id <ROUTER_PROGRAM> --authority <SQUAD_VAULT> --mint <SOL_TOKEN_MINT> --token-admin-registry-admin <SQUAD_VAULT>"
    outcome: "Token Admin Registry PDA created; Squad vault = pending administrator"
  - id: accept-admin-role
    command: "cct-solana-tx router --instruction accept-admin-role --env devnet --program-id <ROUTER_PROGRAM> --authority <SQUAD_VAULT> --mint <SOL_TOKEN_MINT>"
    outcome: "Squad vault is the active CCIP administrator for the token"
  - id: mint-liquidity
    command: "cct-solana-tx spl-token --instruction mint --env devnet --authority <SQUAD_VAULT> --mint <SOL_TOKEN_MINT> --recipient <SQUAD_VAULT> --amount <AMOUNT>"
    outcome: "Liquidity tokens (e.g. 100 tokens = 100000000000) sit in the vault ATA (must already exist — mint does not create it)"
  - id: set-rebalancer
    command: "cct-solana-tx lockrelease-token-pool --instruction set-rebalancer --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <SQUAD_VAULT> --rebalancer <SQUAD_VAULT>"
    outcome: "Squad vault registered as rebalancer (required before any liquidity op)"
  - id: create-pool-ata
    command: "cct-solana-tx lockrelease-token-pool --instruction create-token-account --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <SQUAD_VAULT>"
    outcome: "Pool token ATA (owner = Pool Signer PDA) exists — the pool's token reserve (idempotent)"
  - id: set-can-accept-liquidity
    command: "cct-solana-tx lockrelease-token-pool --instruction set-can-accept-liquidity --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <SQUAD_VAULT> --allow true"
    outcome: "Pool accepts liquidity"
  - id: approve-delegate
    command: "cct-solana-tx spl-token --instruction approve --env devnet --authority <SQUAD_VAULT> --mint <SOL_TOKEN_MINT> --delegate <SOL_POOL_SIGNER_PDA> --amount <AMOUNT>"
    outcome: "Pool Signer PDA approved as delegate over the vault ATA for the liquidity amount"
  - id: provide-liquidity
    command: "cct-solana-tx lockrelease-token-pool --instruction provide-liquidity --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <SQUAD_VAULT> --amount <AMOUNT>"
    outcome: "Tokens moved vault ATA → pool ATA; pool holds release liquidity"
  - id: init-chain-remote-config
    command: "cct-solana-tx lockrelease-token-pool --instruction init-chain-remote-config --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <SQUAD_VAULT> --remote-chain-selector 16015286601757825753 --token-address <ETH_TOKEN_ADDRESS> --decimals 18 --pool-addresses '[]'"
    outcome: "Chain Remote Config PDA for Sepolia created (empty pool addresses)"
  - id: edit-chain-remote-config
    command: "cct-solana-tx lockrelease-token-pool --instruction edit-chain-remote-config --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <SQUAD_VAULT> --remote-chain-selector 16015286601757825753 --token-address <ETH_TOKEN_ADDRESS> --decimals 18 --pool-addresses '[\"<ETH_POOL_ADDRESS>\"]'"
    outcome: "Ethereum remote pool address stored in the chain config"
  - id: set-chain-rate-limit
    command: "cct-solana-tx lockrelease-token-pool --instruction set-chain-rate-limit --env devnet --program-id <POOL_PROGRAM> --mint <SOL_TOKEN_MINT> --authority <SQUAD_VAULT> --remote-chain-selector 16015286601757825753 --inbound-enabled true --inbound-capacity <CAP> --inbound-rate <RATE> --outbound-enabled true --outbound-capacity <CAP> --outbound-rate <RATE>"
    outcome: "Rate limits active for the Sepolia lane (optional step)"
  - id: create-lookup-table
    command: "cct-solana-tx router --instruction create-lookup-table --env devnet --program-id <ROUTER_PROGRAM> --authority <SQUAD_VAULT> --mint <SOL_TOKEN_MINT> --pool-program-id <POOL_PROGRAM> --fee-quoter-program-id <FEE_QUOTER_PROGRAM>"
    outcome: "CCIP ALT created with the 10 base accounts (no SPL multisig needed; execute in Squads within the ~3.5 min slot window)"
  - id: set-pool
    command: "cct-solana-tx router --instruction set-pool --env devnet --program-id <ROUTER_PROGRAM> --authority <SQUAD_VAULT> --mint <SOL_TOKEN_MINT> --pool-lookup-table <ALT_ADDRESS> --writable-indexes '[3,4,7]'"
    outcome: "Pool registered with the router; token is CCIP-enabled on Solana"
  - id: evm-apply-chain-updates
    command: "external: Terminal 2 (Hardhat) — applyChainUpdates + setPool pointing the Sepolia pool at Solana"
    outcome: "Sepolia lane configured; cross-chain transfers can be tested with ccip-cli"
---
# LockRelease Pool with Squads Governance

Lock & Release on Solana: the pool holds a **liquidity reserve** in a pool-owned ATA instead of
minting, so there is no SPL multisig and no mint-authority transfer. A single Squads vault is both
pool owner and rebalancer. This repo covers the Solana side and prints a Base58 transaction to
import into Squads (*Developers -> TX Builder -> Import base58 encoded tx*).

The full walkthrough is the Chainlink tutorial:
<https://docs.chain.link/ccip/tutorials/svm/cross-chain-tokens/lock-release-multisig>
It is the source of truth for prerequisites, the EVM side, and transfer testing.

## Solana steps

The ordered commands and their outcomes are the `steps:` block in this page's front matter.

`--env devnet` and `--authority <SQUAD_VAULT>` throughout
([why the vault, not the multisig](../gotchas/index.md#authority-is-the-vault)).

Remote-chain configuration matches the [burnmint flow](burnmint-production-multisig.md) apart from
the pool program and the ALT, which carries the 10 base addresses only - there is no SPL multisig to
add.

## Ordering constraints

Enforced on chain:

- **Registration before the mint authority moves** (if it moves at all):
  `owner-propose-administrator` requires the signer to be the mint authority.
- **The three liquidity gates, in order.** `provide-liquidity` fails `Unauthorized` without a
  rebalancer, `LiquidityNotAccepted` while `can-accept-liquidity` is false, and SPL Token
  `OwnerMismatch` without the delegate approval - the program pulls tokens by CPI with the pool
  signer PDA as authority.
- **`can-accept-liquidity` gates withdrawals too**, not just deposits
  ([why](../gotchas/index.md#liquidity-gates-apply-to-withdrawals-too)).

## Related

[transaction pipeline](../concepts/transaction-pipeline.md) (never upload a failed simulation) ·
[PDA derivation](../concepts/pda-derivation.md) · [commands](../commands/index.md) ·
[gotchas](../gotchas/index.md) · programs:
[lockrelease-token-pool](../programs/lockrelease-token-pool.md), [router](../programs/router.md),
[spl-token](../programs/spl-token.md)
