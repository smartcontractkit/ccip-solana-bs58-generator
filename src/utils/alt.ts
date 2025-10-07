import {
  AddressLookupTableProgram,
  Connection,
  PublicKey,
  TransactionInstruction,
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { detectTokenProgramId } from './token.js';
import { FEE_QUOTER_SEEDS } from './constants.js';
import { AccountDerivation as RouterDerivation } from '../programs/router/accounts.js';
import { AccountDerivation as BurnmintDerivation } from '../programs/burnmint-token-pool/accounts.js';

export interface BuildAltArgs {
  connection: Connection;
  authority: PublicKey;
  routerProgramId: PublicKey;
  feeQuoterProgramId: PublicKey;
  poolProgramId: PublicKey;
  tokenMint: PublicKey;
  additionalAddresses?: PublicKey[];
}

export interface BuildAltResult {
  lookupTableAddress: PublicKey;
  instructions: TransactionInstruction[];
}

export interface BuildAppendAltArgs {
  connection: Connection;
  authority: PublicKey;
  lookupTableAddress: PublicKey;
  additionalAddresses: PublicKey[];
}

export interface BuildAppendAltResult {
  instructions: TransactionInstruction[];
  totalAddressesAfterAppend: number;
}

export async function buildCreateAndExtendAlt(args: BuildAltArgs): Promise<BuildAltResult> {
  const {
    connection,
    authority,
    routerProgramId,
    feeQuoterProgramId,
    poolProgramId,
    tokenMint,
    additionalAddresses = [],
  } = args;

  const tokenProgramId = await detectTokenProgramId(connection, tokenMint);

  const [tokenAdminRegistryPda] = RouterDerivation.deriveTokenAdminRegistryPda(
    routerProgramId,
    tokenMint
  );
  const [poolConfigPda] = BurnmintDerivation.deriveStatePda(poolProgramId, tokenMint);
  const [poolSignerPda] = BurnmintDerivation.derivePoolSignerPda(poolProgramId, tokenMint);
  const poolTokenAta = getAssociatedTokenAddressSync(
    tokenMint,
    poolSignerPda,
    true,
    tokenProgramId
  );

  const [feeTokenConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(FEE_QUOTER_SEEDS.FEE_BILLING_TOKEN_CONFIG), tokenMint.toBuffer()],
    feeQuoterProgramId
  );
  const [routerPoolSignerPda] = RouterDerivation.deriveExternalTokenPoolsSignerPda(
    routerProgramId,
    poolProgramId
  );

  const recentSlot = await connection.getSlot();
  const createTuple = AddressLookupTableProgram.createLookupTable({
    authority,
    payer: authority,
    recentSlot,
  });
  const [createIx, lookupTableAddress] = createTuple;

  const baseAddresses: PublicKey[] = [
    lookupTableAddress,
    tokenAdminRegistryPda,
    poolProgramId,
    poolConfigPda,
    poolTokenAta,
    poolSignerPda,
    tokenProgramId,
    tokenMint,
    feeTokenConfigPda,
    routerPoolSignerPda,
  ];
  const addresses: PublicKey[] = [...baseAddresses, ...additionalAddresses];

  if (addresses.length > 256) {
    throw new Error(`ALT cannot exceed 256 addresses; requested ${addresses.length}`);
  }

  const extendIxs: TransactionInstruction[] = [];
  const chunkSize = 30; // conservative per-ix limit
  for (let i = 0; i < addresses.length; i += chunkSize) {
    const chunk = addresses.slice(i, i + chunkSize);
    extendIxs.push(
      AddressLookupTableProgram.extendLookupTable({
        payer: authority,
        authority,
        lookupTable: lookupTableAddress,
        addresses: chunk,
      })
    );
  }

  const instructions = [createIx, ...extendIxs];
  return { lookupTableAddress, instructions };
}

export async function buildAppendToAlt(args: BuildAppendAltArgs): Promise<BuildAppendAltResult> {
  const { connection, authority, lookupTableAddress, additionalAddresses } = args;

  // Fetch current ALT state to validate capacity
  const lookupTableAccount = await connection.getAddressLookupTable(lookupTableAddress);
  if (!lookupTableAccount.value) {
    throw new Error(`Address Lookup Table ${lookupTableAddress.toBase58()} not found`);
  }

  const currentAddressCount = lookupTableAccount.value.state.addresses.length;
  const totalAfterAppend = currentAddressCount + additionalAddresses.length;

  if (totalAfterAppend > 256) {
    throw new Error(
      `ALT cannot exceed 256 addresses. Current: ${currentAddressCount}, ` +
        `Adding: ${additionalAddresses.length}, Total would be: ${totalAfterAppend}`
    );
  }

  // Validate authority
  if (!lookupTableAccount.value.state.authority?.equals(authority)) {
    throw new Error(
      `Authority mismatch. Expected: ${authority.toBase58()}, ` +
        `ALT authority: ${lookupTableAccount.value.state.authority?.toBase58() || 'None'}`
    );
  }

  const extendIxs: TransactionInstruction[] = [];
  const chunkSize = 30; // conservative per-ix limit, same as create

  for (let i = 0; i < additionalAddresses.length; i += chunkSize) {
    const chunk = additionalAddresses.slice(i, i + chunkSize);
    extendIxs.push(
      AddressLookupTableProgram.extendLookupTable({
        payer: authority,
        authority,
        lookupTable: lookupTableAddress,
        addresses: chunk,
      })
    );
  }

  return {
    instructions: extendIxs,
    totalAddressesAfterAppend: totalAfterAppend,
  };
}
