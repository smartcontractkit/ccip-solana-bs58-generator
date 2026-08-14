---
type: concept
title: EOA Execution (--execute)
---

# EOA Execution (`--execute`)

By default this CLI is encode-only: it builds and simulates a transaction and prints Base58/Base64
for a Squads multisig to execute; it does not sign or send. The global `--execute` flag signs and
sends the transaction with a local EOA keypair, used for devnet and the EOA variant of the CCT
workflows ([burnmint](../workflows/burnmint-production-multisig.md),
[lockrelease](../workflows/lockrelease-multisig.md)). Encode mode remains the production path.
Shared build/simulate mechanics: [transaction-pipeline](../concepts/transaction-pipeline.md).

## Global flags

| Flag | Meaning | Default |
| --- | --- | --- |
| `--execute` | sign and send with a local keypair instead of printing encoded data | off (encode mode) |
| `--keypair <path>` | signer keypair file (supports `~/` expansion) | `~/.config/solana/id.json` |

Rules enforced in the `src/index.ts` `preAction` hook: `--execute` requires `--env` or
`--rpc-url`; `--keypair` without `--execute` is rejected. The keypair is loaded lazily (only when
execute mode needs it) and cached per invocation (`loadSignerKeypair`, `src/utils/keypair.ts`).
Resolution order is `--keypair` then the default path — there is no environment-variable override.

## What `--execute` does (`src/utils/finalize-transaction.ts`)

Both modes share the same build-and-simulate step; the execute branch adds, in order:

1. **Auto-derive authority** — if `--authority` is omitted it defaults to the keypair's pubkey; if
   supplied it must equal the keypair (an EOA cannot sign for someone else). Encode mode still
   requires `--authority` (the Squads vault). Implemented
   by `applyExecuteAuthority` in `src/utils/keypair.ts`, wired into every command group's
   `preAction` hook.
2. **Keypair-matches-payer check** — `finalizeTransaction` throws if the loaded keypair's pubkey
   is not the transaction fee payer.
3. **Simulation gate** — refuses to send if the build-time simulation failed
   (`tx.metadata.simulationSuccess === false`), mirroring "don't upload a failed sim to Squads"
   ([gotcha](../gotchas/index.md#failed-simulation-gate)).
4. **Signature-verifying simulation** — re-simulates the **signed** transaction with
   `sigVerify: true` (`TransactionBuilder.simulateSignedTransaction`) so a transaction that needs
   a signer the keypair cannot provide (e.g. an SPL-multisig co-signer for a threshold >= 2, or a
   Pool Signer PDA) fails before anything is sent. The default build-time simulation runs unsigned
   (`sigVerify: false`) because the Squads path is unsigned, so this is a separate, execute-only
   check.
5. **Banner** — `TransactionDisplay.displayExecutionBanner` prints an execute-mode banner
   with the signer, instruction, environment, and RPC before sending (plus a mainnet
   "irreversible" warning when on mainnet). Non-interactive, so it is agent/CI safe.
6. **Send** — via `executeTransaction` in `src/utils/transaction-executor.ts`: the transaction is
   built and signed **once** (blockhash fetched at `finalized` commitment), and retries only
   re-broadcast that same signed transaction. Because the signature is identical, the network
   de-duplicates it — a confirm-timeout retry can never double-execute (e.g. no double-mint).
7. **Cluster + explorer** — when `--env` is absent, the cluster is inferred from the chain's
   **genesis hash** (`resolveClusterByGenesisHash` in `src/utils/explorer.ts`,
   provider-agnostic, never leaks the RPC URL); the result drives both the mainnet banner and the
   explorer link in `displayExecutionResults`. Unknown/local RPC degrades to printing the
   signature only — cluster resolution failure never blocks execution.

## Signer model

Every instruction in this repo is single-signer: mints and multisigs are created with
`createAccountWithSeed` (no fresh-account co-signer), and 1-of-N multisig actions need only the
one member. `executeTransaction(connection, instructions, [keypair])` covers the entire admin
surface — no multi-signer machinery exists. For an SPL multisig action, pass only the locally held
member keys in `--multisig-signers` (a 1-of-N needs just the EOA); if the threshold requires a
co-signer that is not held locally, the action is not EOA-executable — use Squads mode (omit
`--execute`). The sigVerify simulation (step 4) enforces this.

## Read-only commands

`get-state`, `get-chain-config`, router `inspect-token` (see [router](../programs/router.md)),
and the `utils` group **reject `--execute`** and don't require `--authority`.

## Mainnet

`--execute` on mainnet works but is gated only by the banner — there is no confirmation
prompt or `--yes` flag, because interactive prompts break agents and CI. Production governance
should go through Squads (encode mode).

## ALT commands

`router create-lookup-table --execute` works: a programmatic send completes in seconds, well
inside the slot window for the slot-derived ALT address; the 60-90 second timing warning is shown
only in encode mode. `pnpm create-alt` remains for the case where an EOA bootstraps a
Squads-owned ALT (see [pda-derivation](../concepts/pda-derivation.md) for the derivation).

## Scope

Execution lives in `finalizeTransaction`, which every write handler calls as its tail. In execute
mode `--authority` defaults to the signer's pubkey; task data (`--mint`, `--program-id`, selectors,
amounts, remote addresses) is not derivable and stays required.

Not covered: `ccip_send` cross-chain transfers (use `@chainlink/ccip-cli`), hardware wallets, remote
signers.

## Examples

```bash
# Encode (default) — Base58 for Squads; --authority is the vault
cct-solana-tx --env devnet router --instruction set-pool --program-id … --mint … --authority <VAULT> …

# Execute with the default keypair; --authority auto-derived
cct-solana-tx --env devnet --execute router --instruction set-pool --program-id … --mint … …

# Execute with a specific keypair
cct-solana-tx --env devnet --execute --keypair ./ops.json spl-token --instruction transfer-mint-authority …
```

Full command surface: [commands](../commands/index.md).
