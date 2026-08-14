---
type: concept
title: Transaction Pipeline
---

# Transaction Pipeline

How a `TransactionInstruction` becomes the encoded blob imported into Squads.
Source: `src/core/transaction-builder.ts`, `src/utils/finalize-transaction.ts`,
`src/utils/display.ts`. Context: [architecture](../concepts/architecture.md).

## `TransactionBuilder` (`src/core/transaction-builder.ts`)

Constructed with `{ rpcUrl }`; opens a `Connection` at commitment `confirmed`
(`DEFAULT_TRANSACTION_CONFIG.COMMITMENT` in `src/utils/constants.ts`).

### `buildTransaction(instructions, payer, instructionName)`

Steps, in order:

1. **Blockhash** — `connection.getLatestBlockhash()` gives `{ blockhash, lastValidBlockHeight }`.
2. **Message** — `new TransactionMessage({ payerKey: payer, recentBlockhash, instructions })`.
3. **Legacy compile** — `transactionMessage.compileToLegacyMessage()`.
   **Legacy, not v0** — the format the Squads UI import field can decode and display for review
   ([gotcha](../gotchas/index.md#legacy-message-squads)).
4. **Serialize + encode**
   ```ts
   const serialized = legacyMessage.serialize();
   const base58Encoded = bs58.encode(serialized);
   const base64Encoded = Buffer.from(serialized).toString('base64');
   const hexEncoded = Buffer.from(serialized).toString('hex');
   ```
5. **Account extraction** — from `instructions[0].keys`: split into `signers`,
   `writableAccounts`, `readOnlyAccounts` by their `isSigner`/`isWritable` flags.
6. **Simulate** — builds a **separate v0 message** (`compileToV0Message()`) wrapped in a
   `VersionedTransaction`, calls `simulateTransaction()`, reads `unitsConsumed` (compute units).
   This simulation is unsigned (`sigVerify: false`) because the Squads path is unsigned.
7. **Return `GeneratedTransaction`** — `{ instruction, base58, base64, hex, accounts[],
   details{…}, metadata{ generatedAt, computeUnits, simulationSuccess, simulationError? } }`.

`buildSingleInstructionTransaction(ix, payer, name)` calls `buildTransaction([ix], …)`.

> Step 5 only inspects `instructions[0]` for the account summary. Most handlers build
> single-instruction transactions; the multi-instruction ones (ALT create/append, `spl-token
> create-mint`, `create-multisig`) still get a summary covering only the first instruction. The
> encoded blob itself always covers every instruction.

### `simulateTransaction(versionedTx)` (private)

`connection.simulateTransaction(tx, { commitment })`. On `value.err` it logs a **warning** with
the program logs and returns `{ success: false, error, logs }` — it does **not** throw, so
generation and display continue (an on-chain run may still succeed, e.g. state that will exist by
execution time). The outcome is recorded in `metadata.simulationSuccess` / `simulationError`.
Operational rule: **failed simulation ⇒ do not upload to Squads**, and `--execute` refuses to send
([gotcha](../gotchas/index.md#failed-simulation-gate)).

### `simulateSignedTransaction(instructions, payer, signer)`

Execute-mode only: signs a v0 message with the keypair and simulates with `sigVerify: true` so a
transaction requiring a signature the local keypair cannot provide fails fast before sending. See
[eoa-execution](../concepts/eoa-execution.md).

## The finalizer (`src/utils/finalize-transaction.ts`)

Every write handler ends with `finalizeTransaction({ txBuilder, instructions, payer,
instructionName, command })`. It:

1. calls `buildTransaction(...)`;
2. resolves the output format: `--format` flag > `CCIP_TX_OUTPUT_FORMAT` env var > `base58`
   (`base58` and `base64` are the valid values, `resolveTransactionOutputFormat` in
   `src/utils/constants.ts`);
3. **encode mode (default)**: prints via `TransactionDisplay.displayResults(tx, name, format)`
   and returns;
4. **`--execute` mode**: runs the gates and sends — see
   [eoa-execution](../concepts/eoa-execution.md).

## Output / Display (`src/utils/display.ts`)

`TransactionDisplay.displayResults(tx, instructionName, format)` prints the sections below through
`logger.info`, except the encoded blob itself, which goes to raw `console.log` (no log prefix or
timestamp, so it copy-pastes cleanly):

- **Transaction Details** — instruction, size (`hex.length / 2` bytes), Base58/Base64 length,
  compute units, `generatedAt`.
- **`COPY TRANSACTION DATA BELOW:`** — the raw Base58 (or Base64) string on its own line, followed
  by a dashed rule.
- **Account Information** — 1-based position, pubkey, and a type tag from `getAccountTypeDisplay()`:
  `(signer, writable)` / `(signer)` / `(writable)` / `(read-only)`.
- **Usage Instructions** — how to import into Squads.
- **Important Notes** — transaction simulated and validated before generation; blockhash valid
  ~2 minutes; compute units are an estimate (printed only when non-zero).

Other helpers: `displaySuccess`, `displayError(error, suggestions[])`,
`displayWarning(warning, details[])`, plus the execute-mode banner and results (see
[eoa-execution](../concepts/eoa-execution.md)).

## Direct execution paths (not multisig)

- The `--execute` global flag signs and sends any write command with a local EOA keypair:
  [eoa-execution](../concepts/eoa-execution.md).
- `scripts/create-alt.ts` bypasses `TransactionBuilder` entirely: it builds the raw
  `AddressLookupTableProgram` create instruction and executes on-chain via `executeTransaction()`
  (sign once, idempotent re-broadcast retries) from `src/utils/transaction-executor.ts`. See
  [utilities](../reference/utilities.md) and [router](../programs/router.md) (ALT section).

## Data flow

```
TransactionInstruction
  -> getLatestBlockhash
  -> TransactionMessage -> compileToLegacyMessage -> serialize -> bs58 / base64 / hex
  -> (v0 copy) simulateTransaction -> unitsConsumed, simulationSuccess
  -> GeneratedTransaction { base58, base64, hex, accounts[], details, metadata }
  -> finalizeTransaction
       -> displayResults (encode mode)
       -> or sign + send (--execute)
```
