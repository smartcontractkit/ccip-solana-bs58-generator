# CCIP Solana BS58 Generator

> **Note**
>
> _This repository represents an example of using a Chainlink product or service. It is provided to help you understand how to interact with Chainlink's systems so that you can integrate them into your own. This template is provided "AS IS" without warranties of any kind, has not been audited, and may be missing key checks or error handling to make the usage of the product more clear. You must thoroughly test and simulate all transactions offchain, validate functionality on testnet/devnet environments, and conduct comprehensive security reviews before deploying to mainnet or any production environment._

CLI (`cct-solana-tx`) that builds, simulates, and Base58-encodes Solana CCIP token-pool admin
transactions for execution through a Squads multisig. It does not sign or send by default — the
encoded output is imported into Squads. `--execute` signs and sends with a local keypair (EOA), and
the read-only commands (`get-state`, `get-chain-config`, `inspect-token`, `derive-accounts`) fetch
and display on-chain state instead of producing a transaction.

Agent entry point: [AGENTS.md](AGENTS.md). Documentation map: [docs/index.md](docs/index.md). The
[command catalog](docs/commands/index.md) has one generated page per CLI instruction
([`catalog.json`](docs/commands/catalog.json) for tooling); regenerate with `pnpm docs:catalog`,
check with `pnpm docs:gate`.

## Installation

Install the tarball attached to a release. Node.js >= 22 is the only prerequisite; the tarball is
already built, so nothing compiles on your machine and `cct-solana-tx` lands on your PATH:

```bash
npm i -g https://github.com/smartcontractkit/ccip-solana-bs58-generator/releases/download/v<version>/chainlink-ccip-solana-bs58-generator-<version>.tgz
cct-solana-tx --version
```

Install a newer release the same way to upgrade; `npm rm -g @chainlink/ccip-solana-bs58-generator`
to remove it.

> Do not install this globally from a git URL. `npm i -g "git+https://…"` fails on npm 11 with
> `sh: tsc: command not found`: npm builds git dependencies through a nested install that does not
> provide the compiler, and rolls the whole install back. Installing a git URL as a project
> *dependency* (without `-g`) does work.

To work on the CLI instead, clone it. In a checkout the same CLI runs through tsx as `pnpm bs58`,
with no build step and no global install:

```bash
git clone https://github.com/smartcontractkit/ccip-solana-bs58-generator.git
cd ccip-solana-bs58-generator
pnpm install
pnpm bs58 --help
```

## Usage

```bash
cct-solana-tx <program|alias> --instruction <name> --env <environment> [flags]
```

Everything below is written for the installed `cct-solana-tx`; in a checkout, read it as `pnpm bs58`.

The documentation ships with the CLI, so it always describes the version you installed:

```bash
cct-solana-tx docs --path     # the docs directory - grep and read it with your own tools
cct-solana-tx docs --list     # every page
cct-solana-tx docs gotchas    # print one page
```

Global options may appear in any order relative to per-instruction flags. Per-instruction flags are
documented in the [command catalog](docs/commands/index.md).

Add `--json` when the output is going somewhere other than a terminal. It puts one JSON document on
stdout and everything else on stderr, so a script or an agent can consume the result directly:

```bash
cct-solana-tx bm --instruction get-state --env devnet --json … | jq .state.config.owner
cct-solana-tx bm --instruction set-rate-limit-admin --env devnet --json … | jq -r .transaction
```

Transaction commands return the encoded transaction alongside `simulation` and, with `--execute`,
the signature. **Check `simulation.success` before uploading anything to Squads** — a failed
simulation still returns a document, because the caller needs the error.

### Programs

| Command | Alias | Purpose | Docs |
| --- | --- | --- | --- |
| `burnmint-token-pool` | `bm` | Burn/mint token pool admin (Anchor) | [docs/programs/burnmint-token-pool.md](docs/programs/burnmint-token-pool.md) |
| `lockrelease-token-pool` | `lr` | Lock/release pool admin + liquidity (Anchor, superset of burnmint) | [docs/programs/lockrelease-token-pool.md](docs/programs/lockrelease-token-pool.md) |
| `router` | `r` | Token admin registry, address lookup tables, `set_pool` (Anchor) | [docs/programs/router.md](docs/programs/router.md) |
| `spl-token` | `spl` | Mint/multisig/authority operations (non-Anchor) | [docs/programs/spl-token.md](docs/programs/spl-token.md) |
| `metaplex` | `mpl` | Token metadata update authority (non-Anchor, UMI) | [docs/programs/metaplex.md](docs/programs/metaplex.md) |
| `utils` | `u` | Helpers: [`derive-accounts`](docs/commands/utils/derive-accounts.md) | [docs/commands/utils/](docs/commands/utils/derive-accounts.md) |

Per-command pages live under [docs/commands/](docs/commands/index.md), one page per instruction. The
reference they hold was previously inline in this README, so links that pointed at a README anchor
land here: <a id="create-multisig"></a>`create-multisig` is now
[docs/commands/spl-token/create-multisig.md](docs/commands/spl-token/create-multisig.md).

### Global options

| Option | Description |
| --- | --- |
| `--env <environment>` (alias `--environment`) | Solana environment: `mainnet`, `devnet`, `testnet`, `localhost` (predefined public RPC endpoints) |
| `--rpc-url <url>` | Custom Solana RPC endpoint; mutually exclusive with `--env` |
| `--execute` | Sign and send with a local keypair instead of printing encoded transaction data; requires `--env` or `--rpc-url` |
| `--keypair <path>` | Keypair file for `--execute` (default `~/.config/solana/id.json`); only valid with `--execute` |
| `--format <format>` | Transaction output format: `base58` (default) or `base64`; also settable via `CCIP_TX_OUTPUT_FORMAT` (flag wins) |
| `--verbose` | Debug-level logging |
| `-v, --version` / `-h, --help` | Version / help |

Every transaction-building command needs exactly one of `--env` or `--rpc-url`. `--authority` is the
Squads **vault** address in encode mode; in `--execute` mode it defaults to the keypair's public
key. Read-only commands do not support `--execute`. See
[docs/concepts/eoa-execution.md](docs/concepts/eoa-execution.md) for the execute-vs-encode split.

### Example

Inspect a pool's on-chain state (read-only, no transaction):

```bash
cct-solana-tx burnmint-token-pool --env devnet --instruction get-state \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo"
```

Build an admin transaction for Squads — set the pool's rate limit admin, with the Squads vault as
`--authority`:

```bash
cct-solana-tx bm --env devnet --instruction set-rate-limit-admin \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "<squads-vault-address>" \
  --new-rate-limit-admin "<new-admin-pubkey>"
```

The CLI compiles a legacy message, simulates a v0 copy of it, and prints the Base58-encoded
transaction to import into Squads. If simulation fails, do **not** upload the transaction — see
[the failed-simulation gate](docs/gotchas/index.md#failed-simulation-gate).

## Development

```bash
pnpm build         # compile
pnpm lint          # eslint
pnpm type-check    # tsc --noEmit
pnpm format        # prettier
pnpm docs:catalog  # regenerate docs/commands/ from the commander source
pnpm docs:gate     # catalog freshness + docs link/anchor checks
```

Conventions and repo layout: [AGENTS.md](AGENTS.md). Architecture:
[docs/concepts/architecture.md](docs/concepts/architecture.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
