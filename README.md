# CCIP Solana BS58 Generator

> **Note**
>
> _This repository represents an example of using a Chainlink product or service. It is provided to help you understand how to interact with Chainlink's systems so that you can integrate them into your own. This template is provided "AS IS" without warranties of any kind, has not been audited, and may be missing key checks or error handling to make the usage of the product more clear. You must thoroughly test and simulate all transactions offchain, validate functionality on testnet/devnet environments, and conduct comprehensive security reviews before deploying to mainnet or any production environment._

A command-line interface for generating Base58 transaction data from Solana program IDLs for multisig execution.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Development Setup](#development-setup)
- [Usage](#usage)
  - [Basic Syntax](#basic-syntax)
  - [Flexible Argument Ordering](#flexible-argument-ordering)
  - [Global Options](#global-options)
  - [Environment and RPC Configuration](#environment-and-rpc-configuration)
- [Programs](#programs)
  - [Burnmint Token Pool](#burnmint-token-pool)
    - [Instructions](#instructions)
      - [Initialize Pool](#initialize-pool)
      - [Transfer Ownership](#transfer-ownership)
      - [Accept Ownership](#accept-ownership)
      - [Set Chain Rate Limit](#set-chain-rate-limit)
      - [Init Chain Remote Config](#init-chain-remote-config)
      - [Edit Chain Remote Config](#edit-chain-remote-config)
      - [Append Remote Pool Addresses](#append-remote-pool-addresses)
      - [Delete Chain Config](#delete-chain-config)
      - [Configure Allow List](#configure-allow-list)
      - [Remove From Allow List](#remove-from-allow-list)
      - [Set Rate Limit Admin](#set-rate-limit-admin)
      - [Get State](#get-state)
      - [Get Chain Config](#get-chain-config)
  - [Lockrelease Token Pool](#lockrelease-token-pool)
    - [Instructions](#lockrelease-instructions)
      - [Initialize Pool](#lockrelease-initialize-pool)
      - [Transfer Ownership](#transfer-ownership)
      - [Accept Ownership](#accept-ownership)
      - [Set Rate Limit Admin](#set-rate-limit-admin)
      - [Get State](#get-state)
      - [Get Chain Config](#get-chain-config)
      - [Init Chain Remote Config](#init-chain-remote-config)
      - [Edit Chain Remote Config](#edit-chain-remote-config)
      - [Append Remote Pool Addresses](#append-remote-pool-addresses)
      - [Delete Chain Config](#delete-chain-config)
      - [Set Chain Rate Limit](#set-chain-rate-limit)
      - [Configure Allow List](#configure-allow-list)
      - [Remove From Allow List](#remove-from-allow-list)
      - [Set Rebalancer](#set-rebalancer)
      - [Set Can Accept Liquidity](#set-can-accept-liquidity)
      - [Provide Liquidity](#provide-liquidity)
      - [Withdraw Liquidity](#withdraw-liquidity)
  - [Router](#router)
    - [Instructions](#router-instructions)
      - [Owner Propose Administrator](#owner-propose-administrator)
      - [Owner Override Pending Administrator](#owner-override-pending-administrator)
      - [Accept Admin Role](#accept-admin-role)
      - [Transfer Admin Role](#transfer-admin-role)
      - [Create Lookup Table](#create-lookup-table)
      - [Set Pool](#set-pool)
  - [SPL Token](#spl-token)
    - [Instructions](#spl-token-instructions)
      - [Create Mint](#create-mint)
      - [Mint](#mint)
      - [Create Multisig](#create-multisig)
      - [Transfer Mint Authority](#transfer-mint-authority)
      - [Update Metadata Authority](#update-metadata-authority)
      - [Approve](#approve)
  - [Metaplex Token Metadata](#metaplex-token-metadata)
    - [Instructions](#metaplex-instructions)
      - [Update Authority](#update-authority)
  - [Common Workflows](#common-workflows)
    - [Setting Up Cross-Chain Token Configuration](#setting-up-cross-chain-token-configuration)
    - [Updating Existing Configuration](#updating-existing-configuration)
  - [Utility Commands](#utility-commands)
    - [Instructions](#utility-instructions)
      - [Derive Accounts](#derive-accounts)
- [Command Reference](#command-reference)
  - [Help Commands](#help-commands)
  - [Common Patterns](#common-patterns)
    - [Development Workflow](#development-workflow)
    - [Debug and Troubleshooting](#debug-and-troubleshooting)
- [Output Format](#output-format)
  - [Transaction Data](#transaction-data)
  - [Log Levels](#log-levels)
- [Error Handling](#error-handling)
  - [Common Errors](#common-errors)
    - [Invalid Public Key Format](#invalid-public-key-format)
    - [Missing Required Options](#missing-required-options)
    - [Environment Configuration](#environment-configuration)
    - [Mutual Exclusivity](#mutual-exclusivity)
- [Development](#development)
  - [Architecture](#architecture)
  - [Adding New Programs](#adding-new-programs)
  - [Adding New Instructions](#adding-new-instructions)
- [License](#license)
- [Contributing](#contributing)
- [Support](#support)

## Overview

This CLI tool generates serialized Solana transactions in Base58 format, specifically designed for execution through multisig interfaces like Squads. It supports multiple Chainlink CCIP programs and provides a type-safe, validated interface for transaction construction.

## Installation

### Prerequisites

- Node.js 22.0.0 or higher
- pnpm package manager

### Development Setup

```bash
git clone <repository-url>
cd ccip-solana-bs58-generator
pnpm install
```

## Usage

### Basic Syntax

```bash
pnpm bs58 <program> [options] --instruction <instruction-name> [instruction-options]
```

### Flexible Argument Ordering

For better user experience, all options can be placed after the program name in any order:

```bash
# All of these are equivalent and valid:
pnpm bs58 burnmint-token-pool --env devnet --instruction transfer-ownership --program-id "..."
pnpm bs58 burnmint-token-pool --instruction transfer-ownership --env devnet --program-id "..."
pnpm bs58 burnmint-token-pool --program-id "..." --env devnet --instruction transfer-ownership
```

### Global Options

| Option                | Alias           | Type    | Description                                              |
| --------------------- | --------------- | ------- | -------------------------------------------------------- |
| `--env <environment>` | `--environment` | string  | Solana environment (mainnet, devnet, testnet, localhost) |
| `--rpc-url <url>`     |                 | string  | Custom Solana RPC endpoint URL                           |
| `--verbose`           |                 | boolean | Enable debug-level logging                               |
| `--version`           | `-v`            |         | Display version information                              |
| `--help`              | `-h`            |         | Display help information                                 |

#### Environment and RPC Configuration

The CLI requires network configuration through either `--env` or `--rpc-url`:

- **Environment-based** (recommended): Uses predefined RPC endpoints
- **Custom RPC**: Specify any Solana RPC endpoint
- **Mutual exclusivity**: Cannot use both options simultaneously

**Supported Environments:**

| Environment | RPC Endpoint                        |
| ----------- | ----------------------------------- |
| `mainnet`   | https://api.mainnet-beta.solana.com |
| `devnet`    | https://api.devnet.solana.com       |
| `testnet`   | https://api.testnet.solana.com      |
| `localhost` | http://localhost:8899               |

## Programs

### Burnmint Token Pool

**Command:** `burnmint-token-pool` (alias: `bm`)

Token pool program for burning tokens on source chain and minting on destination chain.

#### Instructions

##### initialize-pool

Initialize the burn-mint pool state for a given SPL mint. This creates the pool State PDA and wires program-global config (router, RMN) into the pool. The caller becomes the pool owner.

**Syntax:**

```bash
pnpm bs58 burnmint-token-pool --instruction initialize-pool [options]
```

**Options:**

| Option                   | Type      | Required | Description                    |
| ------------------------ | --------- | -------- | ------------------------------ |
| `--program-id <address>` | PublicKey | Yes      | Burnmint token pool program ID |
| `--mint <address>`       | PublicKey | Yes      | Token mint address             |
| `--authority <address>`  | PublicKey | Yes      | Future pool owner (signer)     |

**Example:**

```bash
pnpm bs58 burnmint-token-pool \
  --env devnet \
  --instruction initialize-pool \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY"
```

**Accounts:**

| Index | Account       | Type             | Description                                    |
| ----- | ------------- | ---------------- | ---------------------------------------------- |
| 0     | State         | Writable         | Pool state PDA (`ccip_tokenpool_config`, mint) |
| 1     | Mint          | Read-only        | Token mint                                     |
| 2     | Authority     | Signer, Writable | Pool owner (signer)                            |
| 3     | SystemProgram | Read-only        | System program                                 |
| 4     | Program       | Read-only        | Burn-mint program ID                           |
| 5     | ProgramData   | Read-only        | Program Data PDA (upgradeable loader)          |
| 6     | Global Config | Read-only        | Global config PDA (`config`)                   |

##### transfer-ownership

Transfer ownership of the pool to a proposed new owner.

**Syntax:**

```bash
pnpm bs58 burnmint-token-pool --instruction transfer-ownership [options]
```

**Options:**

| Option                    | Type      | Required | Description                           |
| ------------------------- | --------- | -------- | ------------------------------------- |
| `--program-id <address>`  | PublicKey | Yes      | Burnmint token pool program ID        |
| `--mint <address>`        | PublicKey | Yes      | Token mint address                    |
| `--authority <address>`   | PublicKey | Yes      | Current owner or authorized authority |
| `--proposed-owner <addr>` | PublicKey | Yes      | Proposed new owner public key         |

**Example:**

```bash
pnpm bs58 burnmint-token-pool \
  --env devnet \
  --instruction transfer-ownership \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --proposed-owner "NewOwnerPublicKey123456789..."
```

**Accounts:**

| Index | Account   | Type      | Description                    |
| ----- | --------- | --------- | ------------------------------ |
| 0     | State     | Writable  | Token pool state account (PDA) |
| 1     | Mint      | Read-only | Token mint account             |
| 2     | Authority | Signer    | Current authority account      |

##### accept-ownership

Accept ownership of a token pool previously proposed via transfer-ownership.

**Syntax:**

```bash
pnpm bs58 burnmint-token-pool --instruction accept-ownership [options]
```

**Options:**

| Option                   | Type      | Required | Description                    |
| ------------------------ | --------- | -------- | ------------------------------ |
| `--program-id <address>` | PublicKey | Yes      | Burnmint token pool program ID |
| `--mint <address>`       | PublicKey | Yes      | Token mint address             |
| `--authority <address>`  | PublicKey | Yes      | New authority public key       |

**Example:**

```bash
pnpm bs58 burnmint-token-pool \
  --env devnet \
  --instruction accept-ownership \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY"
```

**Accounts:**

| Index | Account   | Type      | Description                    |
| ----- | --------- | --------- | ------------------------------ |
| 0     | State     | Writable  | Token pool state account (PDA) |
| 1     | Mint      | Read-only | Token mint account             |
| 2     | Authority | Signer    | New authority account          |

**Transaction Output:**

The command generates:

- Base58-encoded transaction data for multisig execution
- Account information with access permissions

##### set-chain-rate-limit

Configure rate limiting for token transfers to/from a specific remote chain. This command ONLY modifies rate limit settings.

**⚠️ PREREQUISITE**: You must run `init-chain-remote-config` first to create the chain configuration before setting rate limits.

**📋 IMPORTANT**: Rate limits are specified in the **smallest token units** (e.g., for a 9-decimal token, 1 token = 1,000,000,000 smallest units).

**Syntax:**

```bash
pnpm bs58 burnmint-token-pool --instruction set-chain-rate-limit [options]
```

**Options:**

| Option                               | Type      | Required | Description                                     |
| ------------------------------------ | --------- | -------- | ----------------------------------------------- |
| `--program-id <address>`             | PublicKey | Yes      | Burnmint token pool program ID                  |
| `--mint <address>`                   | PublicKey | Yes      | Token mint address                              |
| `--authority <address>`              | PublicKey | Yes      | Authority public key (pool owner or rate admin) |
| `--remote-chain-selector <selector>` | u64       | Yes      | Remote chain selector identifier                |
| `--inbound-enabled <enabled>`        | boolean   | Yes      | Enable inbound rate limiting (true/false)       |
| `--inbound-capacity <capacity>`      | u64       | Yes      | Inbound rate limit capacity (token amount)      |
| `--inbound-rate <rate>`              | u64       | Yes      | Inbound refill rate (tokens per second)         |
| `--outbound-enabled <enabled>`       | boolean   | Yes      | Enable outbound rate limiting (true/false)      |
| `--outbound-capacity <capacity>`     | u64       | Yes      | Outbound rate limit capacity (token amount)     |
| `--outbound-rate <rate>`             | u64       | Yes      | Outbound refill rate (tokens per second)        |

**Example:**

```bash
pnpm bs58 burnmint-token-pool \
  --env devnet \
  --instruction set-chain-rate-limit \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --remote-chain-selector "16015286601757825753" \
  --inbound-enabled "true" \
  --inbound-capacity "100000000000" \
  --inbound-rate "1000000000" \
  --outbound-enabled "true" \
  --outbound-capacity "100000000000" \
  --outbound-rate "1000000000"
```

**Accounts:**

| Index | Account     | Type             | Description                          |
| ----- | ----------- | ---------------- | ------------------------------------ |
| 0     | State       | Read-only        | Token pool state account (PDA)       |
| 1     | ChainConfig | Writable         | Chain configuration account (PDA)    |
| 2     | Authority   | Signer, Writable | Authority account (pool owner/admin) |

**Rate Limit Configuration:**

- **Capacity**: Maximum tokens in the bucket (with token decimals)
- **Rate**: Refill rate in tokens per second (with token decimals)
- **Example**: For a token with 9 decimals:
  - Capacity `100000000000` = 100 tokens maximum
  - Rate `1000000000` = 1 token per second refill rate

**Transaction Output:**

The command generates:

- Base58-encoded transaction data for multisig execution
- Account information with access permissions
- Detailed rate limit configuration summary
- Transaction metadata including size and compute units
- Usage instructions for multisig platforms

##### init-chain-remote-config

Initialize remote chain configuration for a given chain selector. This command ONLY sets up pool addresses, token address, and decimals.

**⚠️ IMPORTANT**: This command does **NOT** set rate limits! Rate limits must be configured separately using `set-chain-rate-limit` after initializing the chain config.

Pool addresses must be empty at init; append addresses after initialization.

**Syntax:**

```bash
pnpm bs58 burnmint-token-pool --instruction init-chain-remote-config [options]
```

**Options:**

| Option                               | Type              | Required | Description                                   |
| ------------------------------------ | ----------------- | -------- | --------------------------------------------- |
| `--program-id <address>`             | PublicKey         | Yes      | Burnmint token pool program ID                |
| `--mint <address>`                   | PublicKey         | Yes      | Token mint address                            |
| `--authority <address>`              | PublicKey         | Yes      | Authority public key                          |
| `--remote-chain-selector <selector>` | u64               | Yes      | Remote chain selector                         |
| `--pool-addresses <json>`            | JSON array of hex | Optional | Remote pool addresses (must be empty at init) |
| `--token-address <address>`          | Hex string        | Yes      | Remote token address                          |
| `--decimals <decimals>`              | 0-255             | Yes      | Token decimals                                |

**Example:**

```bash
pnpm bs58 burnmint-token-pool \
  --env devnet \
  --instruction init-chain-remote-config \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --remote-chain-selector "16015286601757825753" \
  --token-address "0x9876dcba..." \
  --decimals "18"
```

**Accounts:**

| Index | Account       | Type             | Description                       |
| ----- | ------------- | ---------------- | --------------------------------- |
| 0     | State         | Read-only        | Token pool state account (PDA)    |
| 1     | ChainConfig   | Writable         | Chain configuration account (PDA) |
| 2     | Authority     | Signer, Writable | Authority account                 |
| 3     | SystemProgram | Read-only        | System program                    |

##### edit-chain-remote-config

Edit an existing remote chain configuration. This command ONLY modifies pool addresses, token address, and decimals.

**⚠️ IMPORTANT**: This command does **NOT** modify rate limits! To change rate limits, use `set-chain-rate-limit` instead.

If `--pool-addresses` is omitted, the on-chain list will be cleared (empty vector).

**Syntax:**

```bash
pnpm bs58 burnmint-token-pool --instruction edit-chain-remote-config [options]
```

**Options:** (same as init)

| Option                               | Type              | Required | Description                           |
| ------------------------------------ | ----------------- | -------- | ------------------------------------- |
| `--program-id <address>`             | PublicKey         | Yes      | Burnmint token pool program ID        |
| `--mint <address>`                   | PublicKey         | Yes      | Token mint address                    |
| `--authority <address>`              | PublicKey         | Yes      | Authority public key                  |
| `--remote-chain-selector <selector>` | u64               | Yes      | Remote chain selector                 |
| `--pool-addresses <json>`            | JSON array of hex | Optional | Remote pool addresses (omit to clear) |
| `--token-address <address>`          | Hex string        | Yes      | Remote token address                  |
| `--decimals <decimals>`              | 0-255             | Yes      | Token decimals                        |

**Example:**

```bash
pnpm bs58 burnmint-token-pool \
  --env devnet \
  --instruction edit-chain-remote-config \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --remote-chain-selector "16015286601757825753" \
  --pool-addresses '["0x1234abcd...", "0x5678efgh..."]' \
  --token-address "0x9876dcba..." \
  --decimals "18"
```

**Accounts:** (same as init)

| Index | Account       | Type             | Description                       |
| ----- | ------------- | ---------------- | --------------------------------- |
| 0     | State         | Read-only        | Token pool state account (PDA)    |
| 1     | ChainConfig   | Writable         | Chain configuration account (PDA) |
| 2     | Authority     | Signer, Writable | Authority account                 |
| 3     | SystemProgram | Read-only        | System program                    |

##### append-remote-pool-addresses

Append additional remote pool addresses to a chain configuration.

**Syntax:**

```bash
pnpm bs58 burnmint-token-pool --instruction append-remote-pool-addresses [options]
```

**Options:**

| Option                               | Type              | Required | Description                    |
| ------------------------------------ | ----------------- | -------- | ------------------------------ |
| `--program-id <address>`             | PublicKey         | Yes      | Burnmint token pool program ID |
| `--mint <address>`                   | PublicKey         | Yes      | Token mint address             |
| `--authority <address>`              | PublicKey         | Yes      | Authority public key           |
| `--remote-chain-selector <selector>` | u64               | Yes      | Remote chain selector          |
| `--addresses <json>`                 | JSON array of hex | Yes      | Addresses to append            |

**Example:**

```bash
pnpm bs58 burnmint-token-pool \
  --env devnet \
  --instruction append-remote-pool-addresses \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --remote-chain-selector "16015286601757825753" \
  --addresses '["0xnew1234...", "0xnew5678..."]'
```

**Accounts:**

| Index | Account       | Type             | Description                       |
| ----- | ------------- | ---------------- | --------------------------------- |
| 0     | State         | Read-only        | Token pool state account (PDA)    |
| 1     | ChainConfig   | Writable         | Chain configuration account (PDA) |
| 2     | Authority     | Signer, Writable | Authority account                 |
| 3     | SystemProgram | Read-only        | System program                    |

##### delete-chain-config

Delete a chain configuration for a given chain selector.

**Syntax:**

```bash
pnpm bs58 burnmint-token-pool --instruction delete-chain-config [options]
```

**Options:**

| Option                               | Type      | Required | Description                    |
| ------------------------------------ | --------- | -------- | ------------------------------ |
| `--program-id <address>`             | PublicKey | Yes      | Burnmint token pool program ID |
| `--mint <address>`                   | PublicKey | Yes      | Token mint address             |
| `--authority <address>`              | PublicKey | Yes      | Authority public key           |
| `--remote-chain-selector <selector>` | u64       | Yes      | Remote chain selector          |

**Example:**

```bash
pnpm bs58 burnmint-token-pool \
  --env devnet \
  --instruction delete-chain-config \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --remote-chain-selector "16015286601757825753"
```

**Accounts:**

| Index | Account     | Type             | Description                       |
| ----- | ----------- | ---------------- | --------------------------------- |
| 0     | State       | Read-only        | Token pool state account (PDA)    |
| 1     | ChainConfig | Writable         | Chain configuration account (PDA) |
| 2     | Authority   | Signer, Writable | Authority account                 |

##### configure-allow-list

Configure allowed addresses and enable/disable the allow list.

**Syntax:**

```bash
pnpm bs58 burnmint-token-pool --instruction configure-allow-list [options]
```

**Options:**

| Option                   | Type                         | Required | Description                        |
| ------------------------ | ---------------------------- | -------- | ---------------------------------- |
| `--program-id <address>` | PublicKey                    | Yes      | Burnmint token pool program ID     |
| `--mint <address>`       | PublicKey                    | Yes      | Token mint address                 |
| `--authority <address>`  | PublicKey                    | Yes      | Authority public key               |
| `--add <json>`           | JSON array of Base58 pubkeys | Yes      | Addresses to add to the allow list |
| `--enabled <boolean>`    | boolean                      | Yes      | Enable or disable the allow list   |

**Example:**

```bash
pnpm bs58 burnmint-token-pool \
  --env devnet \
  --instruction configure-allow-list \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --add '["EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB", "Fht7wA4F9QjKz1nP2sV7Yh8L3bN5cX2Rv9d6QwTpLmNo"]' \
  --enabled "true"
```

**Accounts:**

| Index | Account       | Type             | Description                    |
| ----- | ------------- | ---------------- | ------------------------------ |
| 0     | State         | Writable         | Token pool state account (PDA) |
| 1     | Mint          | Read-only        | Token mint account             |
| 2     | Authority     | Signer, Writable | Authority account              |
| 3     | SystemProgram | Read-only        | System program                 |

##### remove-from-allow-list

Remove addresses from the allow list.

**Syntax:**

```bash
pnpm bs58 burnmint-token-pool --instruction remove-from-allow-list [options]
```

**Options:**

| Option                   | Type                         | Required | Description                         |
| ------------------------ | ---------------------------- | -------- | ----------------------------------- |
| `--program-id <address>` | PublicKey                    | Yes      | Burnmint token pool program ID      |
| `--mint <address>`       | PublicKey                    | Yes      | Token mint address                  |
| `--authority <address>`  | PublicKey                    | Yes      | Authority public key                |
| `--remove <json>`        | JSON array of Base58 pubkeys | Yes      | Addresses to remove from allow list |

**Example:**

```bash
pnpm bs58 burnmint-token-pool \
  --env devnet \
  --instruction remove-from-allow-list \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --remove '["Fht7wA4F9QjKz1nP2sV7Yh8L3bN5cX2Rv9d6QwTpLmNo"]'
```

**Accounts:**

| Index | Account       | Type             | Description                    |
| ----- | ------------- | ---------------- | ------------------------------ |
| 0     | State         | Writable         | Token pool state account (PDA) |
| 1     | Mint          | Read-only        | Token mint account             |
| 2     | Authority     | Signer, Writable | Authority account              |
| 3     | SystemProgram | Read-only        | System program                 |

##### set-rate-limit-admin

Set the rate limit admin for a token pool. The rate limit admin is authorized to configure rate limits using `set-chain-rate-limit`.

**Syntax:**

```bash
pnpm bs58 burnmint-token-pool --instruction set-rate-limit-admin [options]
```

**Options:**

| Option                          | Type      | Required | Description                    |
| ------------------------------- | --------- | -------- | ------------------------------ |
| `--program-id <address>`        | PublicKey | Yes      | Burnmint token pool program ID |
| `--mint <address>`              | PublicKey | Yes      | Token mint address             |
| `--authority <address>`         | PublicKey | Yes      | Current pool owner             |
| `--new-rate-limit-admin <addr>` | PublicKey | Yes      | New rate limit admin address   |

**Example:**

```bash
pnpm bs58 burnmint-token-pool \
  --env devnet \
  --instruction set-rate-limit-admin \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --new-rate-limit-admin "RateLimitAdminPublicKey123456789..."
```

**Accounts:**

| Index | Account   | Type             | Description                    |
| ----- | --------- | ---------------- | ------------------------------ |
| 0     | State     | Writable         | Token pool state account (PDA) |
| 1     | Authority | Signer, Writable | Current pool owner             |

##### get-state

Read and display the current on-chain state of a token pool. This is a **read-only** operation that fetches and deserializes the state account data.

**Syntax:**

```bash
pnpm bs58 burnmint-token-pool --instruction get-state [options]
```

**Options:**

| Option                   | Type      | Required | Description                    |
| ------------------------ | --------- | -------- | ------------------------------ |
| `--program-id <address>` | PublicKey | Yes      | Burnmint token pool program ID |
| `--mint <address>`       | PublicKey | Yes      | Token mint address             |

**Example:**

```bash
pnpm bs58 burnmint-token-pool \
  --env devnet \
  --instruction get-state \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo"
```

**Output:**

The command displays comprehensive information about the pool state:
- Program information (type, version, addresses)
- Token configuration (mint, decimals, token program)
- Pool accounts (signer PDA, token account)
- Governance (owner, proposed owner, rate limit admin)
- Configuration (router, RMN remote)
- Access control (allow list status and addresses)
- Lockrelease-specific fields (rebalancer, liquidity acceptance)

**Note:** This is a **read-only** operation and does not require `--authority`.

##### get-chain-config

Read and display the chain configuration for a specific remote chain, including pool addresses, token information, and current rate limit states with real-time token bucket levels.

**Syntax:**

```bash
pnpm bs58 burnmint-token-pool --instruction get-chain-config [options]
```

**Options:**

| Option                               | Type      | Required | Description                    |
| ------------------------------------ | --------- | -------- | ------------------------------ |
| `--program-id <address>`             | PublicKey | Yes      | Burnmint token pool program ID |
| `--mint <address>`                   | PublicKey | Yes      | Token mint address             |
| `--remote-chain-selector <selector>` | u64       | Yes      | Remote chain selector          |

**Example:**

```bash
pnpm bs58 burnmint-token-pool \
  --env devnet \
  --instruction get-chain-config \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --remote-chain-selector "16015286601757825753"
```

**Output:**

The command displays comprehensive information about the chain configuration:
- Program information (type, chain config PDA)
- Local token information (Solana mint address and decimals)
- Remote token configuration (destination chain token address, decimals, pool addresses)
- Inbound rate limit (enabled status, capacity, rate, current tokens, last updated)
- Outbound rate limit (enabled status, capacity, rate, current tokens, last updated)

**Example Output:**
```
📊 Chain Configuration for Remote Chain: 16015286601757825753

Program Information:
  Program Type:         Burnmint Token Pool
  Program ID:           41FGToCmdaWa1dgZLKFAjvmx6e6AjVTX7SVRibvsMGVB
  Chain Config PDA:     7G8iWscQudiuBHkpCeufgR4hfPk5SssBEWsh6Au4KaF6

Local Token (Solana):
  Mint Address:         63nnXf3wDDLoLGdvFtpAA2NPTyxSMLTo56JBXEvrothB
  Decimals:             9
  Note:                 Rate limits below use these decimals

Remote Token (Destination Chain):
  Token Address:        0x000...5715 (32 bytes)
  Token Decimals:       18
  Pool Addresses:       1 address(es)
    1. 0x4678... (20 bytes)

Inbound Rate Limit: (in local token units)
  Enabled:              true
  Capacity:             20,000,000,000 (20.000000000 tokens)
  Rate:                 100,000,000 (0.100000000 tokens/sec)
  Current Tokens:       20,000,000,000 (20.000000000 available)
  Last Updated:         2025-10-16 13:56:34 UTC
```

**Key Features:**
- **Token Formatting**: Amounts displayed with proper decimals (e.g., "100.000000000 tokens")
- **Current Bucket Levels**: Shows real-time available tokens in rate limit buckets
- **Timestamp Display**: Human-readable dates with UTC timestamps
- **Hex Addresses**: Remote addresses shown with byte lengths
- **Empty Handling**: Gracefully shows when no pool addresses are configured

**Important Notes:**
- This is a **read-only** operation and does not require `--authority`
- **Rate limits are always in local token units** (Solana side decimals), not remote token units
- Remote configuration shows the destination chain token info (address, decimals)

### Lockrelease Token Pool

**Command:** `lockrelease-token-pool` (alias: `lr`)

Token pool program for locking tokens on source chain and releasing on destination chain, with liquidity management features.

**📋 Supported Instructions:**

Lockrelease pools support **ALL burnmint instructions** documented above, plus the following lockrelease-specific instructions:
- ✅ All shared instructions: `initialize-pool`, `transfer-ownership`, `accept-ownership`, `set-rate-limit-admin`, `get-state`, `get-chain-config`, `init-chain-remote-config`, `edit-chain-remote-config`, `append-remote-pool-addresses`, `delete-chain-config`, `set-chain-rate-limit`, `configure-allow-list`, `remove-from-allow-list`
- ➕ Lockrelease-specific: `set-rebalancer`, `set-can-accept-liquidity`, `provide-liquidity`, `withdraw-liquidity`

Simply replace `burnmint-token-pool` with `lockrelease-token-pool` in any burnmint command.

#### Lockrelease Instructions

##### lockrelease-initialize-pool

Initialize the lockrelease pool state for a given SPL mint. This creates the pool State PDA and wires program-global config (router, RMN) into the pool. The caller becomes the pool owner.

**Syntax:**

```bash
pnpm bs58 lockrelease-token-pool initialize-pool [options]
```

**Options:**

| Option                   | Type      | Required | Description                      |
| ------------------------ | --------- | -------- | -------------------------------- |
| `--program-id <address>` | PublicKey | Yes      | Lockrelease token pool program ID |
| `--mint <address>`       | PublicKey | Yes      | Token mint address               |
| `--authority <address>`  | PublicKey | Yes      | Future pool owner (signer)       |

**Example:**

```bash
pnpm bs58 lockrelease-token-pool initialize-pool \
  --env devnet \
  --program-id "8eqh8wppT9c5rw4ERqNCffvU6cNFJWff9WmkcYtmGiqC" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY"
```

**Accounts:**

| Index | Account       | Type             | Description                                      |
| ----- | ------------- | ---------------- | ------------------------------------------------ |
| 0     | State         | Writable         | Pool state PDA (`ccip_tokenpool_config`, mint)  |
| 1     | Mint          | Read-only        | Token mint                                       |
| 2     | Authority     | Signer, Writable | Pool owner (signer)                              |
| 3     | SystemProgram | Read-only        | System program                                   |
| 4     | Program       | Read-only        | Lockrelease program ID                           |
| 5     | ProgramData   | Read-only        | Program Data PDA (upgradeable loader)            |
| 6     | Global Config | Read-only        | Global config PDA (`config`)                     |

##### set-rebalancer

Set the rebalancer address for the pool. The rebalancer is authorized to provide and withdraw liquidity.

**⚠️ PREREQUISITE**: This must be called by the pool owner before any liquidity operations can be performed.

**Syntax:**

```bash
pnpm bs58 lockrelease-token-pool set-rebalancer [options]
```

**Options:**

| Option                   | Type      | Required | Description                      |
| ------------------------ | --------- | -------- | -------------------------------- |
| `--program-id <address>` | PublicKey | Yes      | Lockrelease token pool program ID |
| `--mint <address>`       | PublicKey | Yes      | Token mint address               |
| `--authority <address>`  | PublicKey | Yes      | Authority public key (pool owner) |
| `--rebalancer <address>` | PublicKey | Yes      | New rebalancer address           |

**Example:**

```bash
pnpm bs58 lockrelease-token-pool set-rebalancer \
  --env devnet \
  --program-id "8eqh8wppT9c5rw4ERqNCffvU6cNFJWff9WmkcYtmGiqC" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --rebalancer "RebalancerAddress123456789..."
```

**Accounts:**

| Index | Account   | Type      | Description                    |
| ----- | --------- | --------- | ------------------------------ |
| 0     | State     | Writable  | Token pool state account (PDA) |
| 1     | Mint      | Read-only | Token mint account             |
| 2     | Authority | Signer    | Pool owner account             |

##### set-can-accept-liquidity

Enable or disable the pool's ability to accept liquidity. Only the pool owner can call this instruction.

**⚠️ PREREQUISITE**: The pool must be initialized first.

**Syntax:**

```bash
pnpm bs58 lockrelease-token-pool --instruction set-can-accept-liquidity [options]
```

**Options:**

| Option                   | Type      | Required | Description                         |
| ------------------------ | --------- | -------- | ----------------------------------- |
| `--program-id <address>` | PublicKey | Yes      | Lockrelease token pool program ID   |
| `--mint <address>`       | PublicKey | Yes      | Token mint address                  |
| `--authority <address>`  | PublicKey | Yes      | Authority public key (pool owner)   |
| `--allow <boolean>`      | boolean   | Yes      | Allow liquidity operations (true/false) |

**Example:**

```bash
pnpm bs58 lockrelease-token-pool \
  --env devnet \
  --instruction set-can-accept-liquidity \
  --program-id "8eqh8wppT9c5rw4ERqNCffvU6cNFJWff9WmkcYtmGiqC" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --allow "true"
```

**Accounts:**

| Index | Account   | Type      | Description                    |
| ----- | --------- | --------- | ------------------------------ |
| 0     | State     | Writable  | Token pool state account (PDA) |
| 1     | Mint      | Read-only | Token mint account             |
| 2     | Authority | Signer    | Pool owner account             |

##### provide-liquidity

Provide liquidity to the pool. Only the configured rebalancer can call this instruction.

**⚠️ PREREQUISITE**: The pool owner must call `set-rebalancer` first to authorize a rebalancer address.

**🔍 SMART FEATURES**: 
- Token program automatically detected from mint
- Rebalancer's Associated Token Account (ATA) automatically derived

**Syntax:**

```bash
pnpm bs58 lockrelease-token-pool provide-liquidity [options]
```

**Options:**

| Option                   | Type      | Required | Description                                     |
| ------------------------ | --------- | -------- | ----------------------------------------------- |
| `--program-id <address>` | PublicKey | Yes      | Lockrelease token pool program ID               |
| `--mint <address>`       | PublicKey | Yes      | Token mint address                              |
| `--authority <address>`  | PublicKey | Yes      | Authority address (must be configured rebalancer) |
| `--amount <amount>`      | u64       | Yes      | Amount to provide (in smallest token units)     |

**Example:**

```bash
pnpm bs58 lockrelease-token-pool provide-liquidity \
  --env devnet \
  --program-id "8eqh8wppT9c5rw4ERqNCffvU6cNFJWff9WmkcYtmGiqC" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "RebalancerAddress123456789..." \
  --amount "1000000000"
```

**Accounts:**

| Index | Account              | Type      | Description                                    |
| ----- | -------------------- | --------- | ---------------------------------------------- |
| 0     | State                | Read-only | Token pool state account (PDA)                |
| 1     | TokenProgram         | Read-only | Token program (auto-detected)                  |
| 2     | Mint                 | Writable  | Token mint account                             |
| 3     | PoolSigner           | Read-only | Pool signer PDA                                |
| 4     | PoolTokenAccount     | Writable  | Pool's token account (ATA)                     |
| 5     | RemoteTokenAccount   | Writable  | Rebalancer's token account (ATA, auto-derived) |
| 6     | Authority            | Signer    | Rebalancer account                             |

##### withdraw-liquidity

Withdraw liquidity from the pool. Only the configured rebalancer can call this instruction.

**⚠️ PREREQUISITE**: The pool owner must call `set-rebalancer` first to authorize a rebalancer address.

**🔍 SMART FEATURES**: 
- Token program automatically detected from mint
- Rebalancer's Associated Token Account (ATA) automatically derived

**Syntax:**

```bash
pnpm bs58 lockrelease-token-pool withdraw-liquidity [options]
```

**Options:**

| Option                   | Type      | Required | Description                                     |
| ------------------------ | --------- | -------- | ----------------------------------------------- |
| `--program-id <address>` | PublicKey | Yes      | Lockrelease token pool program ID               |
| `--mint <address>`       | PublicKey | Yes      | Token mint address                              |
| `--authority <address>`  | PublicKey | Yes      | Authority address (must be configured rebalancer) |
| `--amount <amount>`      | u64       | Yes      | Amount to withdraw (in smallest token units)    |

**Example:**

```bash
pnpm bs58 lockrelease-token-pool withdraw-liquidity \
  --env devnet \
  --program-id "8eqh8wppT9c5rw4ERqNCffvU6cNFJWff9WmkcYtmGiqC" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "RebalancerAddress123456789..." \
  --amount "500000000"
```

**Accounts:** (same as provide-liquidity)

| Index | Account              | Type      | Description                                    |
| ----- | -------------------- | --------- | ---------------------------------------------- |
| 0     | State                | Read-only | Token pool state account (PDA)                |
| 1     | TokenProgram         | Read-only | Token program (auto-detected)                  |
| 2     | Mint                 | Writable  | Token mint account                             |
| 3     | PoolSigner           | Read-only | Pool signer PDA                                |
| 4     | PoolTokenAccount     | Writable  | Pool's token account (ATA)                     |
| 5     | RemoteTokenAccount   | Writable  | Rebalancer's token account (ATA, auto-derived) |
| 6     | Authority            | Signer    | Rebalancer account                             |

**📋 Lockrelease Pool Workflow:**

```bash
# Step 1: Initialize the pool (pool owner)
pnpm bs58 lockrelease-token-pool initialize-pool \
  --program-id "<POOL_PROGRAM_ID>" \
  --mint "<TOKEN_MINT>" \
  --authority "<POOL_OWNER>"

# Step 2: Set rebalancer (pool owner, REQUIRED before liquidity operations)
pnpm bs58 lockrelease-token-pool set-rebalancer \
  --program-id "<POOL_PROGRAM_ID>" \
  --mint "<TOKEN_MINT>" \
  --authority "<POOL_OWNER>" \
  --rebalancer "<REBALANCER_ADDRESS>"

# Step 3: Configure chain for cross-chain operations (same as burnmint)
pnpm bs58 lockrelease-token-pool init-chain-remote-config \
  --program-id "<POOL_PROGRAM_ID>" \
  --mint "<TOKEN_MINT>" \
  --authority "<POOL_OWNER>" \
  --remote-chain-selector "<CHAIN_SELECTOR>" \
  --pool-addresses '[]' \
  --token-address "<REMOTE_TOKEN_ADDRESS>" \
  --decimals "<REMOTE_DECIMALS>"

# Step 4: Set rate limits (same as burnmint)
pnpm bs58 lockrelease-token-pool set-chain-rate-limit \
  --program-id "<POOL_PROGRAM_ID>" \
  --mint "<TOKEN_MINT>" \
  --authority "<POOL_OWNER>" \
  --remote-chain-selector "<CHAIN_SELECTOR>" \
  --inbound-enabled "true" \
  --inbound-capacity "<CAPACITY>" \
  --inbound-rate "<RATE>" \
  --outbound-enabled "true" \
  --outbound-capacity "<CAPACITY>" \
  --outbound-rate "<RATE>"

# Step 5: Provide liquidity (rebalancer)
pnpm bs58 lockrelease-token-pool provide-liquidity \
  --program-id "<POOL_PROGRAM_ID>" \
  --mint "<TOKEN_MINT>" \
  --authority "<REBALANCER_ADDRESS>" \
  --amount "<AMOUNT_IN_SMALLEST_UNITS>"

# Step 6: Withdraw liquidity when needed (rebalancer)
pnpm bs58 lockrelease-token-pool withdraw-liquidity \
  --program-id "<POOL_PROGRAM_ID>" \
  --mint "<TOKEN_MINT>" \
  --authority "<REBALANCER_ADDRESS>" \
  --amount "<AMOUNT_IN_SMALLEST_UNITS>"
```

**💡 Key Differences from Burnmint:**
- **Liquidity Management**: Lockrelease pools support liquidity provision/withdrawal
- **Rebalancer Role**: Dedicated rebalancer address for liquidity operations
- **Lock/Release Mechanism**: Tokens are locked (not burned) and released (not minted)
- **Same Chain Config**: Uses identical chain configuration commands as burnmint

### Router

**Command:** `router` (alias: `r`)

CCIP Router for cross-chain messaging, including token admin registry management and pool configuration. PDAs such as `config` and `token_admin_registry` are auto-derived; users do not need to pass them.

#### Router Instructions

##### owner-propose-administrator

Propose an initial/updated administrator for a token’s admin registry (by token owner).

**Syntax:**

```bash
pnpm bs58 router --instruction owner-propose-administrator [options]
```

**Options:**

| Option                                | Type      | Required | Description                                     |
| ------------------------------------- | --------- | -------- | ----------------------------------------------- |
| `--program-id <address>`              | PublicKey | Yes      | Router program ID                               |
| `--mint <address>`                    | PublicKey | Yes      | Token mint address                              |
| `--authority <address>`               | PublicKey | Yes      | Token owner or authorized authority             |
| `--token-admin-registry-admin <addr>` | PublicKey | Yes      | Administrator to propose for the token registry |

**Example:**

```bash
pnpm bs58 router \
  --env devnet \
  --instruction owner-propose-administrator \
  --program-id "Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --token-admin-registry-admin "Fy8m7wKXdnz1pLkM8S1Y3e2r9oLJH3ZkQp4b6c7d8e9f"
```

##### owner-override-pending-administrator

Override the pending admin for a token’s registry (by token owner).

**Syntax:**

```bash
pnpm bs58 router --instruction owner-override-pending-administrator [options]
```

**Options:** (same as propose)

| Option                                | Type      | Required | Description                         |
| ------------------------------------- | --------- | -------- | ----------------------------------- |
| `--program-id <address>`              | PublicKey | Yes      | Router program ID                   |
| `--mint <address>`                    | PublicKey | Yes      | Token mint address                  |
| `--authority <address>`               | PublicKey | Yes      | Token owner or authorized authority |
| `--token-admin-registry-admin <addr>` | PublicKey | Yes      | Administrator to set as pending     |

**Example:**

```bash
pnpm bs58 router \
  --env devnet \
  --instruction owner-override-pending-administrator \
  --program-id "Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --token-admin-registry-admin "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB"
```

##### accept-admin-role

Accept the admin role of the token admin registry (by pending admin).

**Syntax:**

```bash
pnpm bs58 router --instruction accept-admin-role [options]
```

**Options:**

| Option                   | Type      | Required | Description           |
| ------------------------ | --------- | -------- | --------------------- |
| `--program-id <address>` | PublicKey | Yes      | Router program ID     |
| `--mint <address>`       | PublicKey | Yes      | Token mint address    |
| `--authority <address>`  | PublicKey | Yes      | Pending admin address |

**Example:**

```bash
pnpm bs58 router \
  --env devnet \
  --instruction accept-admin-role \
  --program-id "Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "Fy8m7wKXdnz1pLkM8S1Y3e2r9oLJH3ZkQp4b6c7d8e9f"
```

##### transfer-admin-role

Initiate a two-step admin transfer by setting a new pending admin (by current admin).

**Syntax:**

```bash
pnpm bs58 router --instruction transfer-admin-role [options]
```

**Options:**

| Option                   | Type      | Required | Description               |
| ------------------------ | --------- | -------- | ------------------------- |
| `--program-id <address>` | PublicKey | Yes      | Router program ID         |
| `--mint <address>`       | PublicKey | Yes      | Token mint address        |
| `--authority <address>`  | PublicKey | Yes      | Current registry admin    |
| `--new-admin <address>`  | PublicKey | Yes      | New pending admin address |

**Example:**

```bash
pnpm bs58 router \
  --env devnet \
  --instruction transfer-admin-role \
  --program-id "Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB" \
  --new-admin "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY"
```

##### create-lookup-table

Create and extend an Address Lookup Table (ALT) for a mint's Token Admin Registry and pool integration. The resulting ALT address is then passed to `set-pool`.

**Syntax:**

```bash
pnpm bs58 router --instruction create-lookup-table [options]
```

**Options:**

| Option                          | Type      | Required | Description                                               |
| ------------------------------- | --------- | -------- | --------------------------------------------------------- |
| `--program-id <address>`        | PublicKey | Yes      | Router program ID                                         |
| `--fee-quoter-program-id <id>`  | PublicKey | Yes      | Fee Quoter program ID                                     |
| `--pool-program-id <id>`        | PublicKey | Yes      | Burn-mint pool program ID                                 |
| `--mint <address>`              | PublicKey | Yes      | Token mint address                                        |
| `--authority <address>`         | PublicKey | Yes      | ALT authority and payer                                   |
| `--additional-addresses <json>` | JSON      | No       | JSON array of Base58 pubkeys to append after base entries |

Address order inside the ALT:

1. ALT address (self)
2. Token Admin Registry PDA (router)
3. Pool program ID
4. Pool config PDA (burn-mint pool state)
5. Pool token ATA (mint, owner = pool signer PDA, token-program aware)
6. Pool signer PDA (burn-mint)
7. Token program ID (SPL v1 or Token-2022, auto-detected from the mint)
8. Token mint
9. Fee token config PDA (fee quoter)
10. CCIP router pool signer PDA (router, seed external_token_pools_signer + poolProgramId)

Any `--additional-addresses` are appended after index 10. Max total addresses: 256.

**Example:**

```bash
pnpm bs58 router \
  --env devnet \
  --instruction create-lookup-table \
  --program-id "<ROUTER_PID>" \
  --fee-quoter-program-id "<FEE_QUOTER_PID>" \
  --pool-program-id "<BURNMINT_POOL_PID>" \
  --mint "<MINT_PUBKEY>" \
  --authority "<AUTHORITY_PUBKEY>" \
  --additional-addresses '["<EXTRA1>","<EXTRA2>"]'
```

Notes:

- Token program is automatically detected by reading the mint's owner.
- The ALT is created and extended in one transaction and printed before the Base58 payload.

##### append-to-lookup-table

Append additional addresses to an existing Address Lookup Table (ALT). This command validates the ALT exists, checks authority permissions, and ensures the 256-address limit is not exceeded.

**Syntax:**

```bash
pnpm bs58 router --instruction append-to-lookup-table [options]
```

**Options:**

| Option                          | Type      | Required | Description                                               |
| ------------------------------- | --------- | -------- | --------------------------------------------------------- |
| `--lookup-table-address <addr>` | PublicKey | Yes      | Existing ALT address to append to                        |
| `--authority <address>`         | PublicKey | Yes      | ALT authority (must match ALT's current authority)       |
| `--additional-addresses <json>` | JSON      | Yes      | JSON array of Base58 pubkeys to append                   |

**Example:**

```bash
pnpm bs58 router \
  --env devnet \
  --instruction append-to-lookup-table \
  --lookup-table-address "7fYy8hH2jFqJ3c1kRkq2hFvZf8mYb1vZ1g3i2j4k5L6M" \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --additional-addresses '["EXTRA_ADDRESS_1", "EXTRA_ADDRESS_2"]'
```

**Features:**

- **Validation**: Checks ALT exists and authority permissions
- **Capacity Check**: Ensures 256-address limit is not exceeded
- **Chunked Extension**: Safely extends ALT in chunks of 30 addresses
- **State Display**: Shows current and final address counts
- **Error Handling**: Comprehensive error messages with helpful suggestions

**Notes:**

- The ALT must exist and be owned by the specified authority
- Maximum 256 total addresses per ALT (Solana limit)
- Addresses are added in chunks to avoid transaction size limits
- Transaction is simulated before generating Base58 output

##### set-pool

Set the pool lookup table for a token and the list of ALT indexes to mark writable (by registry admin). This enables or updates the CCIP pool configuration for that token.

**Syntax:**

```bash
pnpm bs58 router --instruction set-pool [options]
```

**Options:**

| Option                       | Type       | Required | Description                                                  |
| ---------------------------- | ---------- | -------- | ------------------------------------------------------------ |
| `--program-id <address>`     | PublicKey  | Yes      | Router program ID                                            |
| `--mint <address>`           | PublicKey  | Yes      | Token mint address                                           |
| `--authority <address>`      | PublicKey  | Yes      | Registry admin                                               |
| `--pool-lookup-table <addr>` | PublicKey  | Yes      | Address Lookup Table containing pool and related accounts    |
| `--writable-indexes <json>`  | JSON array | Yes      | JSON array of ALT indexes to mark writable (e.g., `[3,4,7]`) |

**Notes:**

- PDAs like `config` and `token_admin_registry` are automatically derived by the CLI/SDK.
- Writable indexes are passed as Vec<u8>; conversion to on-chain bitmaps happens inside the program.

**Example:**

```bash
pnpm bs58 router \
  --env devnet \
  --instruction set-pool \
  --program-id "Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB" \
  --pool-lookup-table "7fYy8hH2jFqJ3c1kRkq2hFvZf8mYb1vZ1g3i2j4k5L6M" \
  --writable-indexes "[3,4,7]"
```

### SPL Token

**Command:** `spl-token` (alias: `spl`)

SPL token utilities for building raw transactions for multisig execution. The CLI automatically detects whether a mint belongs to SPL Token v1 or Token-2022 by reading the mint account owner on-chain.

#### SPL Token Instructions

##### create-mint

Create a new SPL token mint with optional Metaplex metadata and initial supply. This command supports both SPL Token v1 and Token-2022 programs and can optionally create Metaplex metadata for cross-platform compatibility.

**Syntax:**

```bash
pnpm bs58 spl-token --instruction create-mint [options]
```

**Options:**

| Option                      | Type      | Required | Description                                                   |
| --------------------------- | --------- | -------- | ------------------------------------------------------------- |
| `--authority <address>`     | PublicKey | Yes      | Mint authority and payer (signer)                             |
| `--decimals <number>`       | u8        | Yes      | Token decimals (0-255)                                        |
| `--token-program <program>` | string    | No       | Token program: spl-token or token-2022 (default: spl-token)   |
| `--with-metaplex <boolean>` | boolean   | No       | Create with Metaplex metadata (default: false)                |
| `--name <string>`           | string    | \*       | Token name (required if with-metaplex=true, max 32 chars)     |
| `--symbol <string>`         | string    | \*       | Token symbol (required if with-metaplex=true, max 10 chars)   |
| `--uri <string>`            | string    | \*       | Metadata URI (required if with-metaplex=true)                 |
| `--initial-supply <number>` | number    | No       | Initial supply in smallest units (optional)                   |
| `--recipient <address>`     | PublicKey | \*       | Recipient for initial supply (required if initial-supply > 0) |

**Example (Plain mint):**

```bash
pnpm bs58 spl-token \
  --env devnet \
  --instruction create-mint \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --decimals "9"
```

**Example (Token-2022 with Metaplex metadata):**

```bash
pnpm bs58 spl-token \
  --env devnet \
  --instruction create-mint \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --decimals "9" \
  --token-program "token-2022" \
  --with-metaplex "true" \
  --name "MyToken" \
  --symbol "MTK" \
  --uri "https://example.com/metadata.json"
```

**Example (With initial supply):**

```bash
pnpm bs58 spl-token \
  --env devnet \
  --instruction create-mint \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --decimals "9" \
  --with-metaplex "true" \
  --name "MyToken" \
  --symbol "MTK" \
  --uri "https://example.com/metadata.json" \
  --initial-supply "1000000000000" \
  --recipient "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB"
```

**Features:**

- **Token Program Selection**: Choose between SPL Token v1 and Token-2022
- **Metaplex Integration**: Optional Metaplex metadata for cross-platform compatibility
- **Initial Supply**: Automatically creates recipient ATA and mints initial supply
- **Validation**: Comprehensive parameter validation and helpful error messages
- **Logging**: Detailed progress logging for transparency

**Notes:**

- **Initial Supply**: The `--initial-supply` parameter expects the raw amount in smallest units. For a token with 9 decimals, to mint 1000 tokens, pass `--initial-supply "1000000000000"` (1000 × 10^9).

- Generates a deterministic mint address using `createAccountWithSeed` (multisig compatible)
- If `--with-metaplex=true`, all metadata fields (name, symbol, uri) are required

- Recipient ATA is automatically created if it doesn't exist
- Metaplex metadata supports both SPL Token v1 and Token-2022
- sellerFeeBasisPoints is always set to 0 (no creator fees)

##### mint

Mint tokens to a recipient’s associated token account (ATA). This command builds a single `mintTo` instruction. It does not create the ATA on-chain. If the recipient’s ATA is missing, the CLI prints a warning and the mint will fail when executed unless the ATA exists.

Notes:

- Token program id is detected automatically from the mint.
- The recipient owner address is used to derive the recipient ATA.
- For Token-2022 mints, the associated token program is resolved accordingly.

**Syntax:**

```bash
pnpm bs58 spl-token --instruction mint [options]
```

**Options:**

| Option                      | Type      | Required | Description                                                                              |
| --------------------------- | --------- | -------- | ---------------------------------------------------------------------------------------- |
| `--authority <address>`     | PublicKey | Yes      | Mint authority or payer (signer)                                                         |
| `--mint <address>`          | PublicKey | Yes      | Token mint address                                                                       |
| `--recipient <address>`     | PublicKey | Yes      | Recipient owner address (ATA is derived from this)                                       |
| `--amount <u64>`            | u64       | Yes      | Amount in the smallest unit (according to mint decimals)                                 |
| `--multisig <address>`      | PublicKey | No       | SPL token multisig authority address (if mint authority is MS)                           |
| `--multisig-signers <json>` | JSON      | No       | JSON array of signer pubkeys for multisig authority (required when `--multisig` is used) |

**Example:**

```bash
pnpm bs58 spl-token \
  --env devnet \
  --instruction mint \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --mint "ERmJQ8YdAfttHAM9baxjB1B5s8QJ2mQh4iHMrVq1dzPw" \
  --recipient "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB" \
  --amount "1000000"
```

If using an SPL token multisig as mint authority:

```bash
pnpm bs58 spl-token \
  --env devnet \
  --instruction mint \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --recipient "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB" \
  --amount "1000000" \
  --multisig "7fYy8hH2jFqJ3c1kRkq2hFvZf8mYb1vZ1g3i2j4k5L6M" \
  --multisig-signers '["A1...","B2...","C3..."]'
```

Notes on multisig signers:

- Provide the subset of signer pubkeys that will actually sign this transaction (at least the threshold number). You do not need to include all members if the threshold is lower.
- The order of pubkeys does not matter.
- If `--multisig` is provided, `--multisig-signers` must be a non-empty JSON array.

##### create-multisig

Create and initialize an SPL token multisig account using a deterministic address (base + seed + mint). The CLI requires a `--mint` and automatically detects whether to use SPL Token v1 or Token-2022 from the mint's owner. The mint address is incorporated into the seed to ensure unique multisig addresses per token.

**Syntax:**

```bash
pnpm bs58 spl-token --instruction create-multisig [options]
```

**Options:**

| Option                  | Type                         | Required | Description                                                |
| ----------------------- | ---------------------------- | -------- | ---------------------------------------------------------- |
| `--authority <address>` | PublicKey                    | Yes      | Payer authority (signer)                                   |
| `--seed <string>`       | string                       | Yes      | Seed string for `createAccountWithSeed` (base = authority) |
| `--mint <address>`      | PublicKey                    | Yes      | Mint used to auto-detect the token program (v1/2022)       |
| `--signers <json>`      | JSON array of Base58 pubkeys | Yes      | Multisig signer set                                        |
| `--threshold <m>`       | integer                      | Yes      | Multisig threshold                                         |

The CLI will derive the multisig address with `createAccountWithSeed` and generate both the system account creation and the `initializeMultisig` instruction.

**Example:**

```bash
pnpm bs58 spl-token \
  --env devnet \
  --instruction create-multisig \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --seed "my-multisig-001" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --signers '["A1...","B2...","C3..."]' \
  --threshold "2"

Note: The derived multisig address uses `createAccountWithSeed(authority, compositeSeed, tokenProgramId)` where `compositeSeed = sha256(seed + mint).hex().slice(0,32)`. This ensures each mint gets a unique multisig address even with the same authority and seed combination, while staying within the 32-byte ASCII seed limit.
```

##### transfer-mint-authority

Transfer the mint authority of a token to a new authority. If the current mint authority is an SPL token multisig, provide the multisig address and the signer pubkeys that will sign.

**Syntax:**

```bash
pnpm bs58 spl-token --instruction transfer-mint-authority [options]
```

**Options:**

| Option                        | Type      | Required | Description                                                             |
| ----------------------------- | --------- | -------- | ----------------------------------------------------------------------- |
| `--authority <address>`       | PublicKey | Yes      | Current mint authority (signer, or multisig address if using multisig)  |
| `--mint <address>`            | PublicKey | Yes      | Token mint address                                                      |
| `--new-mint-authority <addr>` | PublicKey | Yes      | New mint authority address                                              |
| `--multisig <address>`        | PublicKey | No       | SPL token multisig authority address (if current authority is multisig) |
| `--multisig-signers <json>`   | JSON      | No       | JSON array of signer pubkeys (required when `--multisig` is used)       |

**Example (single authority):**

```bash
pnpm bs58 spl-token \
  --env devnet \
  --instruction transfer-mint-authority \
  --authority "59eNrR..." \
  --mint "EL4xtG..." \
  --new-mint-authority "Fht7wA..."
```

**Example (multisig authority):**

```bash
pnpm bs58 spl-token \
  --env devnet \
  --instruction transfer-mint-authority \
  --authority "59eNrR..." \
  --mint "EL4xtG..." \
  --new-mint-authority "Fht7wA..." \
  --multisig "7fYy8h..." \
  --multisig-signers '["A1...","B2..."]'
```

##### update-metadata-authority

Update the metadata authority for Token-2022 mints. This uses the Token-2022 Metadata Pointer extension. If your mint uses a separate metadata account, pass it via `--metadata-account`; otherwise, the mint address is used by default. Set `--new-mint-authority` to omit or pass `--new-authority`? No—this instruction specifically updates the metadata authority; pass `--new-authority` if changing, or omit to leave as-is; set to null is not supported via CLI for safety.

**Syntax:**

```bash
pnpm bs58 spl-token --instruction update-metadata-authority [options]
```

**Options:**

| Option                         | Type      | Required | Description                                                     |
| ------------------------------ | --------- | -------- | --------------------------------------------------------------- |
| `--authority <address>`        | PublicKey | Yes      | Current metadata authority                                      |
| `--mint <address>`             | PublicKey | Yes      | Token-2022 mint address                                         |
| `--metadata-account <address>` | PublicKey | No       | Explicit metadata account (if using Metadata Pointer)           |
| `--new-authority <address>`    | PublicKey | No       | New metadata authority (omit to keep current; null not exposed) |

##### approve

Approve a delegate to transfer tokens from a token account. This allows another address (delegate) to transfer up to a specified amount of tokens from the owner's token account.

**Syntax:**

```bash
pnpm bs58 spl-token --instruction approve [options]
```

**Options:**

| Option                          | Type      | Required | Description                                                    |
| ------------------------------- | --------- | -------- | -------------------------------------------------------------- |
| `--authority <address>`         | PublicKey | Yes      | Token account owner (signer)                                   |
| `--mint <address>`              | PublicKey | Yes      | Token mint address                                             |
| `--delegate <address>`          | PublicKey | Yes      | Delegate address to approve                                    |
| `--amount <amount>`             | u64       | Yes      | Amount to approve for delegation (in smallest token units)    |
| `--token-account <address>`     | PublicKey | No       | Token account to approve from (auto-derives if not provided)  |

**Example:**

```bash
# Approve Pool Signer PDA to transfer tokens from rebalancer's ATA
pnpm bs58 spl-token \
  --env devnet \
  --instruction approve \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --mint "FVJeMAQSH9dJvVmhe8NHC2DHTEEqT5cgVXTL5CYYmKu1" \
  --delegate "E8odUv4V4DXy3RWvkNYF7H33X9J56RtsFp4ExVXB86UA" \
  --amount "50000000000"
```

**Use Cases:**
- **Lockrelease Pool**: Required before `provide-liquidity` to allow Pool Signer PDA to transfer from rebalancer's ATA
- **DeFi Protocols**: Allow smart contracts to transfer tokens on behalf of users
- **Automated Trading**: Enable trading bots to operate with user tokens

### Metaplex Token Metadata

**Command:** `metaplex` (alias: `mpl`)

Metaplex Token Metadata program operations (mpl-token-metadata). This is distinct from Token-2022’s metadata extension; use this when your mint’s metadata is managed by Metaplex.

#### Metaplex Instructions

##### update-authority

Update the update authority of a Metaplex metadata account for a given mint. This creates a single Metaplex `updateV1` instruction via UMI and converts it to a web3 instruction for BS58 output.

**Syntax:**

```bash
pnpm bs58 metaplex --instruction update-authority [options]
```

**Options:**

| Option                      | Type      | Required | Description                       |
| --------------------------- | --------- | -------- | --------------------------------- |
| `--authority <address>`     | PublicKey | Yes      | Current update authority (signer) |
| `--mint <address>`          | PublicKey | Yes      | Token mint address                |
| `--new-authority <address>` | PublicKey | Yes      | New update authority address      |

**Example:**

```bash
pnpm bs58 metaplex \
  --env devnet \
  --instruction update-authority \
  --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --new-authority "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB"
```

Notes:

- This targets Metaplex mpl-token-metadata and uses UMI under the hood.
- If your token uses Token-2022's metadata extension instead, use `spl-token --instruction update-metadata-authority`.

## 🔄 **Common Workflows**

### Setting Up Cross-Chain Token Configuration

**⚠️ CRITICAL**: Chain configuration and rate limits are separate! Follow this exact order:

```bash
# Step 1: Initialize the pool (one-time setup)
pnpm bs58 burnmint-token-pool --instruction initialize-pool \
  --program-id "<POOL_PROGRAM_ID>" \
  --mint "<TOKEN_MINT>" \
  --authority "<AUTHORITY>"

# Step 2: Initialize chain config (pool addresses, token info)
pnpm bs58 burnmint-token-pool --instruction init-chain-remote-config \
  --program-id "<POOL_PROGRAM_ID>" \
  --mint "<TOKEN_MINT>" \
  --authority "<AUTHORITY>" \
  --remote-chain-selector "<CHAIN_SELECTOR>" \
  --pool-addresses '[]' \
  --token-address "<REMOTE_TOKEN_ADDRESS>" \
  --decimals "<REMOTE_DECIMALS>"

# Step 3: Set rate limits (separate instruction!)
pnpm bs58 burnmint-token-pool --instruction set-chain-rate-limit \
  --program-id "<POOL_PROGRAM_ID>" \
  --mint "<TOKEN_MINT>" \
  --authority "<AUTHORITY>" \
  --remote-chain-selector "<CHAIN_SELECTOR>" \
  --inbound-enabled "true" \
  --inbound-capacity "<CAPACITY_IN_SMALLEST_UNITS>" \
  --inbound-rate "<RATE_PER_SECOND_IN_SMALLEST_UNITS>" \
  --outbound-enabled "true" \
  --outbound-capacity "<CAPACITY_IN_SMALLEST_UNITS>" \
  --outbound-rate "<RATE_PER_SECOND_IN_SMALLEST_UNITS>"

# Step 4: Add pool addresses (after pools are deployed)
pnpm bs58 burnmint-token-pool --instruction append-remote-pool-addresses \
  --program-id "<POOL_PROGRAM_ID>" \
  --mint "<TOKEN_MINT>" \
  --authority "<AUTHORITY>" \
  --remote-chain-selector "<CHAIN_SELECTOR>" \
  --addresses '["<POOL_ADDRESS_1>", "<POOL_ADDRESS_2>"]'
```

### Updating Existing Configuration

**Updating Pool Addresses or Token Info (NOT rate limits):**

```bash
pnpm bs58 burnmint-token-pool --instruction edit-chain-remote-config \
  --program-id "<POOL_PROGRAM_ID>" \
  --mint "<TOKEN_MINT>" \
  --authority "<AUTHORITY>" \
  --remote-chain-selector "<CHAIN_SELECTOR>" \
  --pool-addresses '["<NEW_POOL_1>", "<NEW_POOL_2>"]' \
  --token-address "<NEW_TOKEN_ADDRESS>" \
  --decimals "<NEW_DECIMALS>"
```

**Updating Rate Limits ONLY:**

```bash
pnpm bs58 burnmint-token-pool --instruction set-chain-rate-limit \
  --program-id "<POOL_PROGRAM_ID>" \
  --mint "<TOKEN_MINT>" \
  --authority "<AUTHORITY>" \
  --remote-chain-selector "<CHAIN_SELECTOR>" \
  --inbound-enabled "true" \
  --inbound-capacity "<NEW_CAPACITY>" \
  --inbound-rate "<NEW_RATE>" \
  --outbound-enabled "false" \
  --outbound-capacity "0" \
  --outbound-rate "0"
```

### Utility Commands

**Command:** `utils` (alias: `u`)

Utility commands for account derivation and address calculation. Essential for getting critical addresses like the Pool Signer PDA.

#### Utility Instructions

##### derive-accounts

Derive and display all relevant account addresses for a given program and mint. This is especially useful for finding the **Pool Signer PDA** that handles autonomous cross-chain operations.

**Syntax:**

```bash
pnpm bs58 utils --instruction derive-accounts [options]
```

**Options:**

| Option                               | Type      | Required | Description                                          |
| ------------------------------------ | --------- | -------- | ---------------------------------------------------- |
| `--program-type <type>`              | enum      | Yes      | Program type: burnmint-token-pool, router, spl-token |
| `--program-id <address>`             | PublicKey | Yes      | Program ID for derivations                           |
| `--mint <address>`                   | PublicKey | Yes      | Token mint address                                   |
| `--pool-program-id <address>`        | PublicKey | No       | Pool program ID (for router derivations)             |
| `--remote-chain-selector <selector>` | u64       | No       | Remote chain selector (for chain config derivations) |

**Examples:**

```bash
# Derive all burnmint token pool accounts (includes Pool Signer PDA!)
pnpm bs58 utils \
  --env devnet \
  --instruction derive-accounts \
  --program-type burnmint-token-pool \
  --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
  --mint "EbrEbzXXUGurxRq55xtie1r4e8rHH99jUAwUaEygrKND"

# Derive router accounts
pnpm bs58 utils \
  --env devnet \
  --instruction derive-accounts \
  --program-type router \
  --program-id "Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C" \
  --mint "EbrEbzXXUGurxRq55xtie1r4e8rHH99jUAwUaEygrKND"
```

**Key Accounts Derived:**

For `burnmint-token-pool`:

- **Pool State PDA**: Main pool configuration (created by `initialize-pool`)
- **🎯 Pool Signer PDA**: **CRITICAL** - Autonomous mint/burn authority for cross-chain operations
- **Global Config PDA**: Program-wide configuration
- **Pool Token ATA**: Pool's token account
- **Chain Config PDA**: Per-chain configuration (if `--remote-chain-selector` provided)

For `router`:

- **Token Admin Registry PDA**: Token administration registry
- **Router Config PDA**: Global router configuration
- **Router Pool Signer PDA**: Router's authority for calling pool programs

**Critical Note:**

The **Pool Signer PDA** is the most important address from this command - it's the autonomous authority that signs all mint/burn transactions for cross-chain operations. This address is **NOT** shown in the `initialize-pool` transaction but is essential for understanding your token's cross-chain infrastructure.

## Command Reference

### Help Commands

```bash
# General help
pnpm bs58 --help

# Program-specific help
pnpm bs58 burnmint-token-pool --help

# Instruction-specific help
pnpm bs58 burnmint-token-pool --instruction accept-ownership --help
```

### Common Patterns

#### Development Workflow

```bash
# 1. Test on devnet first
pnpm bs58 burnmint-token-pool --env devnet --instruction <instruction> [options]

# 2. Validate transaction in multisig
# 3. Execute on mainnet
pnpm bs58 burnmint-token-pool --env mainnet --instruction <instruction> [options]
```

#### Debug and Troubleshooting

```bash
# Enable verbose logging
pnpm bs58 burnmint-token-pool --verbose --env devnet --instruction <instruction> [options]

# Use custom RPC for testing
pnpm bs58 burnmint-token-pool --rpc-url "https://custom-endpoint.com" --instruction <instruction> [options]
```

## Output Format

### Transaction Data

The CLI outputs structured transaction information:

```
🎉 Transaction generated successfully!

📋 Transaction Details:
   Instruction: acceptOwnership
   Size: 179 bytes
   Base58 length: 244 characters
   Compute units: 7,562
   Generated: 2025-01-07T21:38:37.938Z

🎯 COPY TRANSACTION DATA BELOW:

<Base58-encoded-transaction-data>

────────────────────────────────────────────────────────────

📊 Account Information:
   Total accounts: 3
    1. CB9NEes1KzH3WmsnXA1bH3Qyu3gjaKJMfyGNVgtVZw8e (writable)
    2. EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo (read-only)
    3. 59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY (signer)

💡 Usage Instructions:
   1. Copy the Base58 transaction data above
   2. Open your Squads multisig interface
   3. Create a "Custom Transaction" or "Raw Transaction"
   4. Paste the Base58 data into the transaction field
   5. Review all accounts and parameters carefully
   6. Get required signatures from multisig members
   7. Execute the transaction on Solana

🔍 Important Notes:
   • Transaction was simulated and validated before generation
   • All public keys and accounts have been verified
   • Always double-check the transaction details in your multisig
   • Estimated compute units: 7,562
   • This transaction is valid until the blockhash expires (~2 minutes)
```

### Log Levels

| Level   | Condition           | Description                      |
| ------- | ------------------- | -------------------------------- |
| `INFO`  | Always              | Transaction progress and results |
| `DEBUG` | `--verbose`         | Detailed execution information   |
| `WARN`  | Simulation failures | Non-fatal issues                 |
| `ERROR` | Fatal errors        | Command failures                 |

## Error Handling

### Common Errors

#### Invalid Public Key Format

```
❌ Error: Invalid public key format
💡 Suggestions:
   • Ensure public key is 44 characters in Base58 format
   • Example: 11111111111111111111111111111111
```

#### Missing Required Options

```
❌ accept-ownership instruction requires: --program-id, --mint, and --authority

Example:
  $ pnpm bs58 burnmint-token-pool \
    --env devnet \
    --instruction accept-ownership \
    --program-id "3BrkN1XcyeafuMZxomLZBUVdasEtpdMmpWfsEQmzN7vo" \
    --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
    --authority "59eNrRrxrZMdqJxS7J3WGaV4MLLog2er14kePiWVjXtY"
```

#### Environment Configuration

```
❌ Either --env or --rpc-url is required for transaction commands
💡 Use --env devnet or --rpc-url "https://custom-endpoint.com"
```

#### Mutual Exclusivity

```
❌ Cannot use both --env and --rpc-url simultaneously
💡 Choose one:
   • Use --env for predefined environments (devnet, mainnet, testnet, localhost)
   • Use --rpc-url for custom endpoints
```

## Development

### Architecture

The CLI follows a modular architecture:

```
src/
├── commands/             # Program-specific command implementations
│   ├── burnmint/         # Burnmint token pool commands
│   ├── router/           # Router commands
│   └── spl-token/        # SPL Token commands (CLI surface)
├── core/                 # Core transaction building logic
├── programs/             # Program IDLs and instruction builders
│   ├── burnmint-token-pool/
│   ├── router/
│   └── spl-token/        # SPL Token instruction builders
├── types/                # TypeScript type definitions and Zod schemas
└── utils/                # Shared utilities (validation, logging, program id detection, etc.)
```

### Adding New Programs

To add support for a new program:

1. **Create program directory:**

   ```
   src/commands/<program-name>/
   ├── index.ts           # Command registration
   └── <instruction>.ts   # Instruction implementations
   ```

2. **Add program IDL:**

   ```
   src/programs/<program-name>/
   ├── idl.json          # Program IDL
   └── instructions.ts   # Instruction builders
   ```

3. **Register commands:**

   ```typescript
   // src/commands/index.ts
   import { create<ProgramName>Commands } from './<program-name>/index.js';

   export function registerCommands(program: Command): void {
     program.addCommand(create<ProgramName>Commands());
   }
   ```

### Adding New Instructions

1. **Implement instruction logic:**

   ```typescript
   // src/commands/<program>/index.ts
   .requiredOption('--instruction <instruction>', 'Instruction to execute (accept-ownership|new-instruction)')
   ```

2. **Add instruction handler:**

   ```typescript
   .action((options, command) => {
     if (options.instruction === 'new-instruction') {
       newInstructionCommand(options, command);
     }
     // ... existing instructions
   });
   ```

3. **Create instruction implementation:**
   ```typescript
   // src/commands/<program>/new-instruction.ts
   export async function newInstructionCommand(
     options: NewInstructionOptions,
     command: Command
   ): Promise<void> {
     // Implementation
   }
   ```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
