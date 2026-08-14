---
type: index
---

# Gotchas

Irreversible steps, counterintuitive behaviour, and errors whose message points at the wrong cause.

Anchor error numbers are `6000 + the variant's position` in the program's error enum, so they shift
when a variant is inserted ahead of them. Match the error name in the program logs; treat the number
as a hint.

## Failed simulation gate

A failed simulation means do not upload the transaction to Squads. The CLI simulates a v0 copy
of every built transaction; if simulation fails, the encoded output is printed for debugging only.
In encode mode the failure is a `WARN` and the process still exits 0, so read the simulation section
rather than trusting the exit code. See [the simulation gate](../decisions/simulation-gate.md).

## Legacy message Squads

The encoded output is a legacy message, not v0. The v0 copy exists only so the simulation can
use address lookup tables; it is never printed. Do not paste a simulation artifact into Squads.

Message **version** and output **encoding** are independent:

- **Version**: legacy (what the CLI emits) vs v0 (simulation only). A legacy message lists every
  account it touches, so a reviewer can see the whole transaction without resolving lookup tables.
- **Encoding**: `--format base58` (default) or `base64`, also settable via `CCIP_TX_OUTPUT_FORMAT`.
  **Both encode the same legacy message** - base64 output is a supported, Squads-importable format,
  not a "simulation" format.

The Squads v4 *program* does support address lookup tables (verified on devnet); the legacy
default is about what the web UI's import field can decode and display for review. See
[the decision](../decisions/legacy-message.md).

## Authority is the vault

`--authority` is the Squads vault address, not the multisig account. The vault PDA is what signs
the inner instruction when the proposal executes: Squads passes only the vault seeds
(`["multisig", <multisig>, "vault", <vault_index>]`) to `invoke_signed`, so the multisig account
itself never signs.

Passing the multisig address produces a proposal that can be created, proposed and approved, and
then can never execute - a permanently stuck artifact. Two independent things block it: the execute
transaction ends up requiring an ed25519 signature from the multisig account, which is a PDA with no
private key (`Transaction did not pass signature verification`), and the pool's own owner check
rejects the address regardless (`AnchorError caused by account: authority … Unauthorized`).

The CLI does not hard-stop this. It builds the legacy message with the authority as fee payer, so
a program-owned multisig address makes simulation fail with `InvalidAccountForFee` - which names the
fee payer, not the authority, and is only a `WARN` before the transaction is printed anyway. Treat
that warning as a stop signal and re-check the authority.

## Metadata backend decides the instruction

**Which instruction updates a metadata authority depends on where the metadata lives, not on the
token program.** Choose the backend at creation with `create-mint --metadata`:

| `--metadata` | Where metadata lives | Update the authority with | Token program |
| --- | --- | --- | --- |
| `metaplex` (or `--with-metaplex true`) | separate Metaplex PDA | `metaplex --instruction update-authority` | either |
| `token-2022` | inside the mint (TokenMetadata extension) | `spl-token --instruction update-metadata-authority` | Token-2022 only |

Using the wrong pair fails, at different points: `--metadata token-2022` with
`--token-program spl-token` is refused up front, and `update-metadata-authority` refuses a mint that
is not Token-2022 at all. A Token-2022 mint whose metadata lives in a Metaplex PDA passes that check
and fails later on chain, for want of the `TokenMetadata` extension.

**The embedded choice is only available at creation, and it is permanent.** The irreversible part
is the `MetadataPointer` extension, not the metadata itself: its `initialize` unpacks the mint with
`unpack_uninitialized`, so the pointer must be added before `InitializeMint` on a freshly allocated
account. `TokenMetadata` can be written after `InitializeMint`, but only onto a mint that already
carries the pointer, and Token-2022's `Reallocate` rejects anything that is not a token account, so
it cannot add the pointer to an existing mint. A mint created without it can never gain embedded
metadata.

Metaplex metadata is a separate PDA and can be attached to a mint at any time. So for a Token-2022
mint the decision at creation is: embed now, or keep the option of adding Metaplex metadata later.

## Vault mint needs squads tx

Minting as the Squads vault through an SPL multisig cannot be done with this CLI.
`spl-token --instruction mint --multisig <ms> --multisig-signers '["<member>"]'` works when the
member is a plain keypair (sign it with `--execute --keypair <member>`), but the Squads vault is a
PDA with no keypair: in encode mode the CLI compiles a message whose fee payer is the vault, which
Squads cannot import. Mint as the vault by wrapping the SPL `MintTo` in a Squads vault transaction
(`vaultTransactionCreate` -> `proposalCreate` -> approve -> `vaultTransactionExecute`), so the vault
PDA signs by CPI from the Squads program.

## Devnet read after write

A freshly created account can read back as missing right after it is created, so a chained
`--execute` sequence can fail with Anchor `AccountNotInitialized` (3012) against an account the
previous command just created. Observed on devnet with `initialize-pool`, `accept-admin-role` and
`append-remote-pool-addresses`.

This is specific to `--execute`. The executor confirms at `confirmed`, reads use `confirmed`, and
each CLI invocation opens its own connection - so the write and the follow-up read are seconds apart
and may land on different nodes of a load-balanced endpoint. `confirmed` means the cluster voted,
not that the node answering your next request has replayed that slot yet. The Squads path never hits
this: the account is created by the multisig execution, long after the CLI ran.

The two stages can disagree, because they are separate requests that can land on different nodes:
the build-time simulation passes on a current node while the send's preflight hits one that is
behind. The CLI absorbs both - a simulation failing with `AccountNotInitialized` is retried briefly,
and a send whose preflight reports it gets a longer retry budget, bounded inside the blockhash
lifetime.

A wrong PDA derivation produces the same error, so nothing is hidden: it fails the build-time gate
and never reaches the send. If a command still fails after the retries, the account really is
absent - check with `solana account <pda>` and suspect the derivation.

## Mint authority multisig

**Give the mint authority to an SPL token multisig that includes the pool signer PDA, not to the PDA
directly.** The pool signer PDA is a pure CPI-signing PDA with no keypair and no account: it signs
only what the pool program signs for it, so CCIP can mint through it but no human ever can. Who else
belongs in the multisig is the project's decision, and it is permanent - **SPL multisigs are
immutable: members and threshold are fixed at creation.**

- `[pool signer PDA, Squads vault]` (threshold 1) is the governed setup: CCIP mints autonomously,
  humans mint and can still issue `SetAuthority` through the vault.
- `[pool signer PDA, wallet]` is the same arrangement for a project without a Squads multisig.
- `[pool signer PDA]` alone leaves no manual mint and no `SetAuthority`, ever. Note the pool's own
  `validate_multisig_config` requires at least two members with at least one non-pool-signer, so a
  single-member multisig is rejected by `transfer_mint_authority_to_multisig`.

An SPL multisig can only execute SPL token instructions, which is why pool and CCIP governance stay
on the Squads layer. See
[the burnmint production workflow](../workflows/burnmint-production-multisig.md).

## Register the admin before moving mint authority

**`owner-propose-administrator` is signed by the mint authority, so it has to run before
`transfer-mint-authority` hands that authority to the SPL multisig.** Reversed, it fails simulation
with `{"InstructionError":[0,{"Custom":7000}]}`, which is `CcipRouterError::Unauthorized`: the router
rejecting a signer that no longer holds the mint authority. The error names neither the authority it
wanted nor the ordering.

Both workflows already order it correctly ([EOA](../workflows/burnmint-spl-token-multisig.md),
[Squads](../workflows/burnmint-production-multisig.md)). This page is for anyone who assembled the
steps from the command catalog and is now looking up the error code.

Recovery does not need a new mint. In either arrangement above the wallet or Squads vault is a member
at threshold 1, so it can still issue `SetAuthority` to take the mint authority back, register, and
hand it over again. `[pool signer PDA]` alone leaves no such path, which is what the pool's
two-member rule above exists to prevent.

## Init pool addresses empty

**`init-chain-remote-config` requires `--pool-addresses` to be empty; on
`edit-chain-remote-config`, omitting it clears the existing addresses.** Edit is a whole-struct
overwrite, not a merge. Append remote pools with `append-remote-pool-addresses` after init.

A chain config with no remote pool addresses does not fail at configuration time: inbound transfers
revert `InvalidSourcePoolAddress` when the source pool is checked against the empty list.

## Allow list enabled and empty blocks everyone

An enabled allow list with no entries blocks every sender, it does not mean "no restriction":
the on-chain check is `!enabled || list.contains(sender)`, so removing the last entry leaves the
most restrictive state possible (`InvalidSender` 6006). The fix is disabling the list, not
repopulating it. The list gates outbound transfers only; inbound release/mint does not consult it.

## Liquidity gates apply to withdrawals too

`can-accept-liquidity = false` blocks withdrawals as well as deposits (`LiquidityNotAccepted`
6020). Deposits have a third gate that withdrawals do not: the rebalancer's token account must first
`approve` the POOL SIGNER PDA as delegate, or the transfer CPI fails with SPL Token `OwnerMismatch`
(`0x4`).

## u64 LE selectors

Chain selectors and all u64s encode little-endian, including inside PDA seeds (`u64LE(selector)`
in the chain-config seed). A big-endian selector derives a wrong PDA that simulates as an
uninitialized account.

## SPL and metaplex not anchor

`spl-token` and `metaplex` are NOT Anchor programs. SPL Token and Token-2022 use a single
leading byte tag; Metaplex uses a Borsh enum variant index. Neither uses an Anchor discriminator, so
pool/router encoding rules do not apply to them.

One exception to the single-byte rule: Token-2022's embedded-metadata instructions come from
`spl-token-metadata-interface`, which prefixes an 8-byte discriminator -
`sha256("spl_token_metadata_interface:<name>")[0..8]`, for example `…:update_the_authority`. Same
width as an Anchor discriminator, different namespace; do not treat it as one.

## Execute signs and sends

`--execute` breaks the encode-only contract on purpose. It signs with a local keypair and sends
immediately; never use it for an operation that should go through the multisig. See
[EOA execution](../concepts/eoa-execution.md).
