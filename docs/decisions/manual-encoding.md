---
type: decision
title: Why instruction data is encoded by hand
---

# Why instruction data is encoded by hand

Instruction data is written byte by byte in `src/programs/<prog>/instructions.ts`, and accounts are
derived by hand in `src/programs/<prog>/accounts.ts`. Anchor's IDL-driven coder is not used, even
though `src/programs/*/idl.json` exists.

## The IDLs cannot drive a coder

The Solana CCIP programs are built with **anchor-lang 0.29**
(`chainlink-ccip/chains/solana/contracts/Anchor.toml`), which has two limitations that decide this:

**It does not inline cross-crate types.** The pool programs' argument types (`RemoteConfig`,
`RateLimitConfig`, `RemoteAddress`) live in the separate `base_token_pool` crate, so no published
pool IDL is self-contained. Upstream build artifacts ship `types: []`; the on-chain IDL accounts fail
with `Type not found: cfg`; the copies in this repo work only because their `types` were merged in by
hand. Using a coder would mean owning a fetch/convert/merge pipeline as a build dependency.

**It does not emit PDA seed metadata.** No IDL from any source carries `pda`/`seeds`, so account
addresses cannot be resolved from an IDL. Every PDA derivation and account meta stays hand-written
regardless of how argument bytes are produced. A coder would replace roughly 125 lines - about 6% of
`instructions.ts` - and nothing in `accounts.ts`.

## The failure modes point the same way

This CLI emits a blob that humans approve in a multisig, and its only automated gate is simulation,
which cannot tell a correct encoding from a well-formed encoding of the wrong value (see
[the simulation gate](simulation-gate.md)).

Anchor's coder fails silently in exactly that way: passing an argument name in the wrong case encodes
a `u64` as **zero** without raising, which would produce a rate-limit instruction targeting chain
selector 0 instead of the intended chain. Hand-written encoding fails loudly instead - discriminator
mismatch, `InstructionDidNotDeserialize`, account count errors - before anything reaches the
multisig.

## The invariants

u64 little-endian · PublicKey = 32 bytes · `Vec<T>` = u32-LE length prefix + elements · Anchor
discriminator = `sha256("global:<snake_name>")[0..8]`. See [encoding](../concepts/encoding.md).

The IDLs in `src/programs/*/idl.json` are reference and registry metadata only. The sole functional
use is `AnchorUtils.validateInstructionExists`, a name check.

## What this costs

Byte layouts must be kept in sync with the on-chain Rust program by hand: adding or altering an
instruction means editing three files in lockstep (commands index, `instructions.ts`, `accounts.ts`)
plus the Zod schema. Non-Anchor programs (`spl-token`, `metaplex`) use their own libraries either
way; see [the gotcha](../gotchas/index.md#spl-and-metaplex-not-anchor).

## When to revisit

If the programs are rebuilt with Anchor >= 0.30, which emits self-contained types and seed metadata,
both structural blockers disappear. Until then the useful safeguards are a byte-parity test against a
merged IDL and an IDL freshness check, not a coder on the output path.
