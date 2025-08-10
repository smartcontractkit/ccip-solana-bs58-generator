# CCIP Solana BS58 Generator

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
      - [Transfer Ownership](#transfer-ownership)
      - [Accept Ownership](#accept-ownership)
      - [Set Chain Rate Limit](#set-chain-rate-limit)
      - [Init Chain Remote Config](#init-chain-remote-config)
      - [Edit Chain Remote Config](#edit-chain-remote-config)
      - [Append Remote Pool Addresses](#append-remote-pool-addresses)
      - [Delete Chain Config](#delete-chain-config)
      - [Configure Allow List](#configure-allow-list)
      - [Remove From Allow List](#remove-from-allow-list)
  - [Router](#router)
    - [Instructions](#router-instructions)
      - [Owner Propose Administrator](#owner-propose-administrator)
      - [Owner Override Pending Administrator](#owner-override-pending-administrator)
      - [Accept Admin Role](#accept-admin-role)
      - [Transfer Admin Role](#transfer-admin-role)
      - [Set Pool](#set-pool)
      - [Create Lookup Table](#create-lookup-table)
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

Configure rate limiting for token transfers to/from a specific remote chain.

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

Initialize remote chain configuration for a given chain selector.
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

Edit an existing remote chain configuration.
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

##### set-pool

Set the pool lookup table for a token and writable indexes bitmap (by registry admin). This enables or updates the CCIP pool configuration for that token.

**Syntax:**

```bash
pnpm bs58 router --instruction set-pool [options]
```

**Options:**

| Option                       | Type       | Required | Description                                                         |
| ---------------------------- | ---------- | -------- | ------------------------------------------------------------------- |
| `--program-id <address>`     | PublicKey  | Yes      | Router program ID                                                   |
| `--mint <address>`           | PublicKey  | Yes      | Token mint address                                                  |
| `--authority <address>`      | PublicKey  | Yes      | Registry admin                                                      |
| `--pool-lookup-table <addr>` | PublicKey  | Yes      | Address Lookup Table containing pool and related accounts           |
| `--writable-indexes <hex>`   | Hex string | Yes      | Bitmap of writable LUT indexes (bytes, hex-encoded; e.g. `0x80...`) |

**Notes:**

- PDAs like `config` and `token_admin_registry` are automatically derived by the CLI/SDK.
- The writable indexes bitmap is validated on-chain against the registry’s configuration.

**Example:**

```bash
pnpm bs58 router \
  --env devnet \
  --instruction set-pool \
  --program-id "Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C" \
  --mint "EL4xtGMgYoYtM4FcFnehiQJZFM2AsfqdFikgZK2y9GCo" \
  --authority "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB" \
  --pool-lookup-table "7fYy8hH2jFqJ3c1kRkq2hFvZf8mYb1vZ1g3i2j4k5L6M" \
  --writable-indexes "0x80"
```

##### create-lookup-table

Create and extend an Address Lookup Table (ALT) for a mint’s Token Admin Registry and pool integration. The resulting ALT address is then passed to `set-pool`.

**Syntax:**

```bash
pnpm bs58 router --instruction create-lookup-table [options]
```

**Options:**

| Option                          | Type      | Required | Description                                                        |
| ------------------------------- | --------- | -------- | ------------------------------------------------------------------ |
| `--program-id <address>`        | PublicKey | Yes      | Router program ID                                                  |
| `--fee-quoter-program-id <id>`  | PublicKey | Yes      | Fee Quoter program ID                                              |
| `--pool-program-id <id>`        | PublicKey | Yes      | Burn-mint pool program ID                                          |
| `--mint <address>`              | PublicKey | Yes      | Token mint address                                                 |
| `--authority <address>`         | PublicKey | Yes      | ALT authority and payer                                            |
| `--additional-addresses <json>` | JSON      | No       | JSON array of Base58 pubkeys to append after base entries          |

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
- Token program is automatically detected by reading the mint’s owner.
- The ALT is created and extended in one transaction and printed before the Base58 payload.

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
├── commands/           # Program-specific command implementations
│   └── burnmint/      # Burnmint token pool commands
├── core/              # Core transaction building logic
├── programs/          # Program IDLs and instruction builders
├── types/             # TypeScript type definitions
└── utils/             # Shared utilities
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

## Contributing

[Contributing guidelines]

## Support

[Support information]
