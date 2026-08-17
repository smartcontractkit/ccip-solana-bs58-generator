---
type: reference
title: Metaplex Token Metadata
---

# Metaplex Token Metadata

CLI command `metaplex` (alias `mpl`) · Source `src/commands/metaplex/`,
`src/programs/metaplex/instructions.ts`.
Flags and usage: [commands reference](../commands/index.md). Non-Anchor encoding notes:
[encoding](../concepts/encoding.md).

**Non-Anchor.** Uses the Metaplex **UMI** framework. `new InstructionBuilder(umi)`; methods build a
UMI instruction, then convert to web3.js via `toWeb3JsInstruction()`
(`@metaplex-foundation/umi-web3js-adapters`).

mpl-token-metadata instruction data is a **Borsh enum variant index**, not an 8-byte discriminator:
`UpdateV1` is a `u8` `50` (the `Update` variant) followed by a `u8` `0` (the `V1` sub-variant), then
the Borsh-encoded optional fields.

## Instructions

| CLI `--instruction` | UMI builder | Required flags |
| --- | --- | --- |
| `update-authority` | `updateV1` (`@metaplex-foundation/mpl-token-metadata`) | `--authority --mint --new-authority` |

Used to move the Metaplex metadata **update authority** for a token (distinct from the SPL mint
authority handled in [spl-token](spl-token.md)). Token name/symbol/URI metadata is created during
`spl-token create-mint --metadata metaplex` (older spelling: `--with-metaplex true`).

Before building, the command derives the metadata PDA and reads it: it exits if no Metaplex metadata
account exists for the mint (pointing at `spl-token update-metadata-authority` for Token-2022
embedded metadata), and warns — without failing — if `--authority` is not the metadata's current
update authority.
