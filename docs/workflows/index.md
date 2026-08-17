---
type: index
---

# Workflows

This repo is the Solana-side tooling in Chainlink's Cross-Chain Token tutorials. The tutorials are
the walkthroughs (prerequisites, EVM side, transfer testing); the pages here list the CLI commands
and the on-chain constraints that fix their order.

## Chainlink CCT tutorials for SVM

Two conventions on docs.chain.link:

- <https://docs.chain.link/ccip/llms.txt> is a curated index of the CCIP documentation.
- Appending `.md` to any page URL returns raw markdown with the command blocks intact. Fetch that
  rather than the rendered page.

All four tutorials below use this CLI for the Solana side. The upstream
[SVM tutorials hub](https://docs.chain.link/ccip/tutorials/svm.md) lists only the first three -
lock-release is reachable by URL but not linked from it.

| Governance model | Tutorial | Page here |
| --- | --- | --- |
| Mint authority moved directly to the Pool Signer PDA. Development only; the token issuer cannot undo it (only the pool program's upgrade authority can). | [direct-mint-authority](https://docs.chain.link/ccip/tutorials/svm/cross-chain-tokens/direct-mint-authority) | none - follow the tutorial |
| 1-of-2 SPL multisig, no Squads, signed locally with `--execute`. | [spl-token-multisig-tutorial](https://docs.chain.link/ccip/tutorials/svm/cross-chain-tokens/spl-token-multisig-tutorial) | [burnmint-spl-token-multisig](burnmint-spl-token-multisig.md) |
| Squads for CCIP administration plus an SPL multisig holding mint authority. | [production-multisig-tutorial](https://docs.chain.link/ccip/tutorials/svm/cross-chain-tokens/production-multisig-tutorial) | [burnmint-production-multisig](burnmint-production-multisig.md) |
| Lock & Release: the pool holds a liquidity reserve instead of minting. One Squads vault is pool owner and rebalancer. | [lock-release-multisig](https://docs.chain.link/ccip/tutorials/svm/cross-chain-tokens/lock-release-multisig) | [lockrelease-multisig](lockrelease-multisig.md) |

Other SVM references on docs.chain.link (all accept the `.md` suffix):

| Topic | URL |
| --- | --- |
| Cross-chain token concepts for SVM | `/ccip/concepts/cross-chain-token/svm` |
| SVM best practices | `/ccip/concepts/best-practices/svm` |
| SVM program interfaces | `/ccip/api-reference/svm` |
| Sending from Solana / receiving on Solana / receiver programs | `/ccip/tutorials/svm/source`, `/destination`, `/receivers` |

## Common to all flows

- The CLI simulates every transaction it builds. A failed simulation is not uploaded
  ([transaction pipeline](../concepts/transaction-pipeline.md)).
- `--authority` is the Squads vault address, not the multisig account
  ([why](../gotchas/index.md#authority-is-the-vault)).
- Squads import path: *Developers -> TX Builder -> Import base58 encoded tx*.
- Rate limits are denominated in the local token's smallest units. Solana tokens in these flows use
  9 decimals, EVM 18.

Edge cases: [gotchas](../gotchas/index.md).
