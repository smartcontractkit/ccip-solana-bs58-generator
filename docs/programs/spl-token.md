---
type: reference
title: SPL Token
---

# SPL Token

CLI command `spl-token` (alias `spl`) · Source `src/commands/spl-token/`,
`src/programs/spl-token/instructions.ts`.
Flags and usage: [commands reference](../commands/index.md). Non-Anchor encoding notes:
[encoding](../concepts/encoding.md).

**Non-Anchor.** Encodes instructions via `@solana/spl-token` / `@solana/spl-token-metadata`
helpers. Two different encodings are involved, neither of them Anchor's:

- SPL Token / Token-2022 instructions start with a **1-byte tag** (`InitializeMint` = 0,
  `InitializeMultisig` = 2, `Approve` = 4, `SetAuthority` = 6, `MintTo` = 7).
- The Token-2022 **metadata-interface** instructions (`InitializeTokenMetadata`,
  `UpdateAuthority`) start with an **8-byte** `sha256("spl_token_metadata_interface:<name>")[0..8]`
  discriminator — same shape as Anchor's, different preimage.

`new InstructionBuilder(tokenProgramId)`. For every instruction that takes an existing `--mint`, the
token program is detected from the mint owner (`detectTokenProgramId`,
[utilities](../reference/utilities.md)), so both **SPL Token (legacy)** and **Token-2022** work.
`create-mint` is the exception: the mint does not exist yet, so the program comes from
`--token-program` (default `spl-token`).

## Instructions

| CLI `--instruction` | Helper used | Notes |
| --- | --- | --- |
| `create-mint` | `SystemProgram.createAccountWithSeed` + `createInitializeMintInstruction`, plus the metadata instructions selected by `--metadata` | `createAccountWithSeed` (base = `--authority`) avoids a mint keypair signer, so a Squads vault can be the payer. The seed is generated per run (`mint_<timestamp>_<random>`), so the mint address is not reproducible; freeze authority is set to the mint authority. `--metadata metaplex` (or the older `--with-metaplex true`) appends a Metaplex `createV1` instruction writing a separate PDA; `--metadata token-2022` prepends `InitializeMetadataPointer` and appends `InitializeTokenMetadata`, embedding metadata in the mint, and requires `--token-program token-2022`. Embedded metadata can only be added at creation. See [the metadata backends](../gotchas/index.md#metadata-backend-decides-the-instruction) |
| `create-multisig` | `createAccountWithSeed` + `createInitializeMultisigInstruction` | builds the SPL multisig used as **mint authority** in the burnmint workflow (Pool Signer PDA + Squads vault). The address is `createWithSeed(authority, sha256(--seed ‖ mint).hex[0..32], tokenProgram)`, so it is reproducible. SPL limits: 1-11 signers, and the token program checks the threshold and the signer count independently - it never verifies threshold <= signers, so a multisig created that way initializes and is then permanently unusable. This CLI rejects it up front |
| `mint` | `createMintToInstruction` | supports `--multisig` + `--multisig-signers` mode (mint authority = SPL multisig) |
| `transfer-mint-authority` | `createSetAuthorityInstruction` (`AuthorityType.MintTokens`) | move mint authority (e.g. Squads vault → SPL multisig); supports multisig signing |
| `update-metadata-authority` | `createUpdateAuthorityInstruction` (spl-token-metadata) | moves the update authority of metadata **embedded in the mint** (Token-2022 `TokenMetadata` extension); **rejects non-Token-2022 mints**. Metaplex-PDA metadata uses [`metaplex update-authority`](metaplex.md) instead. Omitting `--new-authority` encodes `None`, which removes the authority irreversibly |
| `approve` | `createApproveInstruction` | delegate spend (e.g. approve Pool Signer PDA over the vault ATA for lockrelease liquidity); auto-derives `--token-account` as the `--authority` ATA if omitted |

A `SplTransferFreezeAuthorityArgsSchema` exists in `src/types/index.ts` but no
`transfer-freeze-authority` instruction is routed in the CLI
(see [validation and types](../reference/validation-and-types.md)).

## Where it's used

- **[Burnmint workflow](../workflows/burnmint-production-multisig.md)**: `create-mint` (Squads
  vault as mint authority) → `create-multisig` (Layer-2 SPL multisig) → `transfer-mint-authority`
  (vault → SPL multisig). Minting afterwards needs `--multisig` + `--multisig-signers`; the vault
  itself cannot use that path (no keypair) — see
  [minting as the vault](../gotchas/index.md#vault-mint-needs-squads-tx).
- **[Lockrelease workflow](../workflows/lockrelease-multisig.md)**: `create-mint` → `mint`
  (liquidity prep) → `approve` (Pool Signer PDA as delegate).

See also: [metaplex](metaplex.md) for the metadata update authority,
[gotchas](../gotchas/index.md).
