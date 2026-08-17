---
type: reference
title: Utilities
---

# Utilities (`src/utils/`)

Cross-cutting helpers, listed by file.
Related: [PDA derivation](../concepts/pda-derivation.md),
[transaction pipeline](../concepts/transaction-pipeline.md),
[encoding](../concepts/encoding.md), [EOA execution](../concepts/eoa-execution.md).

## constants.ts

- `SOLANA_ENVIRONMENTS` (env → RPC), `getRpcUrl(env)`, `SOLANA_GENESIS_HASHES`
  (mainnet/devnet/testnet genesis hashes for cluster inference), `CLI_CONFIG` (name/desc/version),
  `DEFAULT_TRANSACTION_CONFIG.COMMITMENT = 'confirmed'`, `DEFAULT_KEYPAIR_PATH`
  (`~/.config/solana/id.json`).
- Output format: `TRANSACTION_OUTPUT_FORMATS = ['base58', 'base64']`, default `base58`;
  `TX_OUTPUT_FORMAT_ENV_VAR = 'CCIP_TX_OUTPUT_FORMAT'`; `parseTransactionOutputFormat`,
  `resolveTransactionOutputFormat` (flag > env var > default), `getEncodedTransactionData(tx, format)`.
- Seed constants: `BURNMINT_TOKEN_POOL`, `LOCKRELEASE_TOKEN_POOL`, `ROUTER_SEEDS`,
  `FEE_QUOTER_SEEDS`; `PROGRAM_IDS.BPF_LOADER_UPGRADEABLE_PROGRAM_ID`.
  See [PDA derivation](../concepts/pda-derivation.md).

## Single-purpose helpers

| File | Exports | Detail |
| --- | --- | --- |
| `anchor.ts` — AnchorUtils | `calculateDiscriminator`, `buildInstruction`, `validateInstructionExists` | [encoding](../concepts/encoding.md) |
| `accounts.ts` — AccountBuilder | fluent account-meta builder: `add`/`addSigner`/`addWritable`/`addReadOnly`/`build` | [PDA derivation](../concepts/pda-derivation.md) |
| `addresses.ts` | `normalizeHexString`, `hexToBytes`, `leftPad`, `hexToPadded32Bytes` | |
| `validation.ts` | `validateArgs`, `isValidUrl` | [validation and types](validation-and-types.md) |
| `logger.ts` — pino | `createLogger`, `logger` (singleton), `createChildLogger`, `logTiming` | pretty output in dev; level set by `--verbose` |

## token.ts

- `detectTokenProgramId(connection, mint)` — fetches the mint account, inspects `info.owner`;
  returns `TOKEN_PROGRAM_ID` (SPL v1) or `TOKEN_2022_PROGRAM_ID`; throws if unsupported or mint
  missing. Drives token-program-aware ATA derivation across the pool `create-token-account`,
  lockrelease liquidity, router/ALT, spl-token and metaplex flows.
- `findAssociatedTokenAddress` — ATA derivation with explicit token program.
- `readMint` (→ `MintSummary`: authorities, decimals, supply) and `readMultisigIfAny`
  (→ `MultisigSummary`: threshold + members when an authority is an SPL multisig). Used by
  [router](../programs/router.md) `inspect-token`.

## alt.ts

`deriveCcipBaseAddresses` (the 10 deterministic CCIP base addresses),
`buildCreateAndExtendAlt` (create + extend, 30 addresses per extend instruction, 256-address cap),
`buildAppendToAlt` (verifies authority, appends with the same chunk/cap rules).
See the ALT section in [router](../programs/router.md).

## display.ts — TransactionDisplay

Public statics: `displayResults(tx, name, format)` (format-aware: Base58 or Base64 copy-paste block,
account table, usage instructions), `displayExecutionBanner`, `displayExecutionResults`,
`displaySuccess/Error/Warning`. The account table is rendered by a private `displayAccountInfo`
helper. Output goes through the pino logger (plus a few `console.log`s), kept copy-paste clean.
See [transaction pipeline](../concepts/transaction-pipeline.md).

## keypair.ts

`--execute` keypair plumbing: `expandHomePath`, `resolveKeypairPath` (`--keypair` or
`DEFAULT_KEYPAIR_PATH`), `loadSignerKeypair` (loads once, cached on global options),
`applyExecuteAuthority` (in `--execute` mode auto-derives `--authority` from the keypair, or errors
if a provided `--authority` doesn't match). See [EOA execution](../concepts/eoa-execution.md).

## finalize-transaction.ts

`finalizeTransaction({ txBuilder, instructions, payer, instructionName, command })` — the shared
tail of every handler. Builds the transaction, then either displays encoded output (Squads mode,
format resolved via `resolveTransactionOutputFormat`) or, with `--execute`: checks the keypair
matches the payer, aborts if the build-time simulation failed, re-simulates the signed transaction
with `sigVerify` enabled (to fail when another signature is required, e.g. an SPL multisig
threshold that cannot be met locally), resolves the cluster by genesis hash when `--env` is absent, and
sends via `executeTransaction`. See [EOA execution](../concepts/eoa-execution.md).

## transaction-executor.ts

- `loadKeypair(path)` — reads a Solana CLI JSON keypair (array of 64 ints) → `Keypair`.
- `executeTransaction(connection, instructions, signers, options?)` — builds a legacy `Transaction`
  with a `finalized` blockhash, signs once, then up to 3 attempts of
  `sendRawTransaction` (preflight on, RPC `maxRetries: 2`) + `confirmTransaction('confirmed')`,
  with exponential backoff between attempts (`min(1000 * 2^(n-1), 5000)` ms). The budget extends to
  8 attempts if the preflight reports `AccountNotInitialized`, which usually means the RPC node has
  not replayed the slot that created the account
  ([why](../gotchas/index.md#devnet-read-after-write)). Retries re-broadcast the identical signed
  bytes, so a retry after a confirmation timeout cannot double-execute. Used by
  `scripts/create-alt.ts` and by `--execute` mode via `finalizeTransaction`.

## explorer.ts

`getTransactionExplorerUrl(sig, env)`, `getAddressExplorerUrl(addr, env)` (append
`?cluster=devnet|testnet`; none for mainnet), and `resolveClusterByGenesisHash(connection)` —
infers the cluster from the chain's genesis hash so explorer links and the mainnet warning are
correct even with a bare `--rpc-url`.
