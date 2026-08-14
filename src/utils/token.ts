import { Connection, PublicKey } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MULTISIG_SIZE,
  getMint,
  getMultisig,
  getExtensionTypes,
  ExtensionType,
} from '@solana/spl-token';
import { logger } from './logger.js';

export async function detectTokenProgramId(
  connection: Connection,
  mint: PublicKey
): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint);
  if (!info) throw new Error(`Mint account not found: ${mint.toBase58()}`);
  const owner = info.owner;
  if (owner.equals(TOKEN_PROGRAM_ID)) {
    logger.info({ mint: mint.toBase58(), programId: owner.toBase58() }, 'Detected SPL Token v1');
    return owner;
  }
  if (owner.equals(TOKEN_2022_PROGRAM_ID)) {
    logger.info(
      { mint: mint.toBase58(), programId: owner.toBase58() },
      'Detected Token-2022 program'
    );
    return owner;
  }
  const message = `Unsupported token program for mint ${mint.toBase58()}: ${owner.toBase58()}`;
  logger.error(message);
  throw new Error(message);
}

/**
 * Calculate the Associated Token Account address without on-curve validation
 * (works for both SPL Token and Token-2022 via the passed tokenProgramId).
 */
export function findAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
  tokenProgramId: PublicKey
): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgramId.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

/** Decoded summary of a mint account (program-agnostic). */
export interface MintSummary {
  tokenProgramId: PublicKey;
  mintAuthority: PublicKey | null;
  freezeAuthority: PublicKey | null;
  decimals: number;
  supply: bigint;
  /**
   * Token-2022 extension names; empty for an SPL Token mint.
   *
   * A transfer hook, a transfer fee, or a permanent delegate each change what a transfer does, so
   * the token program ID alone does not say how the pool's tokens move.
   */
  extensions: string[];
}

/**
 * Read a mint account, auto-detecting whether it is owned by SPL Token or Token-2022.
 */
export async function readMint(connection: Connection, mint: PublicKey): Promise<MintSummary> {
  const tokenProgramId = await detectTokenProgramId(connection, mint);
  const info = await getMint(connection, mint, undefined, tokenProgramId);
  // getMint already fetched the whole account and the extension TLV sits in its trailing bytes, so
  // naming the extensions costs no extra request.
  const extensions = info.tlvData.length
    ? getExtensionTypes(info.tlvData).map(t => ExtensionType[t] ?? `unknown(${t})`)
    : [];
  return {
    tokenProgramId,
    mintAuthority: info.mintAuthority,
    freezeAuthority: info.freezeAuthority,
    decimals: info.decimals,
    supply: info.supply,
    extensions,
  };
}

/** Decoded SPL Token multisig (threshold + members). */
export interface MultisigSummary {
  m: number;
  n: number;
  signers: PublicKey[];
}

/**
 * If the given address is an initialized SPL Token / Token-2022 multisig account, decode its
 * threshold and members; otherwise return null (e.g. it is a plain wallet, PDA, or Squads vault).
 */
export async function readMultisigIfAny(
  connection: Connection,
  address: PublicKey
): Promise<MultisigSummary | null> {
  const info = await connection.getAccountInfo(address);
  if (!info) return null;
  const isTokenProgram =
    info.owner.equals(TOKEN_PROGRAM_ID) || info.owner.equals(TOKEN_2022_PROGRAM_ID);
  if (!isTokenProgram || info.data.length !== MULTISIG_SIZE) return null;
  const ms = await getMultisig(connection, address, undefined, info.owner);
  if (!ms.isInitialized) return null;
  const signers = Array.from({ length: ms.n }, (_, i) => ms[`signer${i + 1}` as keyof typeof ms]);
  return { m: ms.m, n: ms.n, signers: signers as PublicKey[] };
}
