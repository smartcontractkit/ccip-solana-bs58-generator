---
type: decision
title: Why the output is a legacy message
---

# Why the output is a legacy message

The CLI compiles the transaction as a **legacy** message and Base58-encodes it. A v0 copy of the
same instructions is compiled only to run the simulation, and is never printed.

## Why legacy

The output is pasted into the Squads web app's "Import base58 encoded tx" field. That importer lives
in the web app, not the SDK (`@sqds/multisig` has no deserializer; its only entry point for
transaction content is a `TransactionMessage` object), so the app decodes the pasted bytes itself
before showing a reviewer what the transaction does.

A legacy message lists every account it touches, so it decompiles standalone. A v0 message that uses
address lookup tables does not: its accounts are partly indirect, and decompiling it needs the
resolved tables. The importer decodes before resolving anything, calling
`TransactionMessage.decompile(message, { addressLookupTableAccounts: [] })` with a hardcoded empty
array ([`public-v4-client`](https://github.com/Squads-Protocol/public-v4-client),
`src/lib/transaction/decodeAndDeserialize.ts`), so the decode throws:

| Pasted message | Result |
| --- | --- |
| legacy | accepted |
| v0 with no address table lookups | accepted |
| v0 with address table lookups | rejected: `Failed to decode transaction: Failed to find address lookup table account for table key <key>` |

The limitation is narrower than "the importer cannot handle v0": it handles v0 fine, and
`importTransaction.ts` does fetch lookup tables and pass them to `vaultTransactionCreate` - that code
is simply unreachable because the decode already threw. Rejection does not depend on the table
existing; the one used in testing is live on devnet and is never fetched.

This is a property of the import field, not of Squads. The v4 program supports address lookup tables -
it stores `addressTableLookups` in the vault transaction account and resolves them at execute time
(confirmed on devnet), and the same client resolves them correctly when *displaying* an existing vault
transaction. Anyone driving Squads through the SDK is not bound by this.

Scope: the table above was produced by pasting each message into the running client (v1.4.1) and
reading the result, and the deprecated `squads-v4-public-ui` carries byte-identical import logic. The
hosted `app.squads.so` is closed-source and was not inspected. Legacy is accepted everywhere
regardless, which is why it stays the default.

## Why the v0 copy exists

Simulation runs against a v0 copy so that ALT-dependent flows can still be validated. It is a
throwaway used for `simulateTransaction` only.

## What this costs

- **No ALTs on the output path.** A transaction that only fits with lookup tables cannot be produced
  for the Squads import field by this tool; `scripts/create-alt.ts` exists because ALT creation is
  done outside that flow.
- The simulated message is not byte-identical to the printed one, though it carries the same
  instructions in the same order.

Message version and output encoding are independent: `--format base58|base64` both encode the same
legacy message. See [the gotcha](../gotchas/index.md#legacy-message-squads).

## When to revisit

If the importer starts resolving lookup tables before `decompile` (watch
`src/lib/transaction/decodeAndDeserialize.ts`), or if a transaction is needed that cannot fit in a
legacy message.
