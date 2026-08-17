---
type: decision
title: Why every transaction is simulated
---

# Why every transaction is simulated

The pipeline simulates every built transaction before printing the encoded output, and a failed
simulation means the transaction must not be uploaded to Squads.

## Why

A Squads proposal that fails on execution wastes a signing ceremony: every signer has to review and
approve again after the fix. Simulating first catches such a transaction before it is proposed.

Simulation runs against a v0 copy of the instructions, because the printed message is legacy and
cannot reference lookup tables (see [legacy message](legacy-message.md)).

## What it does not catch

Simulation validates structure and current state. It cannot tell a correct encoding from a
well-formed encoding of the wrong value - two swapped arguments of the same type simulate cleanly.
That limitation is why instruction data is [written by hand](manual-encoding.md) rather than produced
by a coder that can fail silently.

## What this costs

- An RPC endpoint (`--env` or `--rpc-url`) is required even for encode-only use.
- A transaction that simulates cleanly can still fail later if state changes between encoding and
  multisig execution, for example an ownership transfer landing in between.
- In encode mode a failed simulation is a warning and the process still exits 0, so the simulation
  section must be read rather than the exit code. See
  [the gotcha](../gotchas/index.md#failed-simulation-gate).
