import { Command } from 'commander';
import { Connection, PublicKey } from '@solana/web3.js';
import { validateArgs } from '../../utils/validation.js';
import { InspectTokenArgsSchema } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { AccountDerivation as RouterDerivation } from '../../programs/router/accounts.js';
import { AccountDerivation as PoolDerivation } from '../../programs/burnmint-token-pool/accounts.js';
import { deserializeTokenAdminRegistry } from '../../programs/router/registry.js';
import { deserializePoolState } from '../../programs/shared/pool-state.js';
import { readMint, readMultisigIfAny } from '../../utils/token.js';
import { deriveCcipBaseAddresses } from '../../utils/alt.js';

const NONE = PublicKey.default; // 11111111111111111111111111111111

/**
 * Read-only auditor: reports, for a mint, the CCIP token admin registry, the pool state, the mint
 * authority (incl. SPL multisig members), and the ALT — to verify a deployment's governance config.
 */
export async function inspectTokenCommand(
  options: Record<string, string>,
  command: Command
): Promise<void> {
  try {
    const global = command.parent?.opts() || {};

    const parsed = validateArgs(InspectTokenArgsSchema, {
      programId: options.programId,
      mint: options.mint,
      poolProgramId: options.poolProgramId,
      feeQuoterProgramId: options.feeQuoterProgramId,
      rpcUrl: global.resolvedRpcUrl,
    });
    if (!parsed.success) {
      console.error(`❌ Invalid arguments: ${parsed.errors.join(', ')}`);
      process.exit(1);
    }

    const {
      programId: routerProgramId,
      mint,
      poolProgramId,
      feeQuoterProgramId,
      rpcUrl,
    } = parsed.data;
    const rpc = rpcUrl ?? (global.resolvedRpcUrl as string);
    const connection = new Connection(rpc, 'confirmed');

    // Build a label map of known derived addresses for friendly annotation.
    const [poolStatePda] = PoolDerivation.deriveStatePda(poolProgramId, mint);
    const [poolSignerPda] = PoolDerivation.derivePoolSignerPda(poolProgramId, mint);
    const [registryPda] = RouterDerivation.deriveTokenAdminRegistryPda(routerProgramId, mint);
    const labels = new Map<string, string>([
      [poolSignerPda.toBase58(), 'Pool Signer PDA'],
      [poolStatePda.toBase58(), 'Pool Config PDA'],
      [registryPda.toBase58(), 'Token Admin Registry PDA'],
      [mint.toBase58(), 'Token Mint'],
    ]);
    const lbl = (pk: PublicKey): string => {
      const l = labels.get(pk.toBase58());
      return l ? `  ← ${l}` : '';
    };

    console.log('🔎 CCIP Token Configuration Inspector');
    console.log(`   Mint:            ${mint.toBase58()}`);
    console.log(`   Router program:  ${routerProgramId.toBase58()}`);
    console.log(`   Pool program:    ${poolProgramId.toBase58()}`);
    console.log('');

    // ── Mint authority ───────────────────────────────────────────────
    console.log('═══ MINT ═══');
    const mintInfo = await readMint(connection, mint);
    console.log(`  Token Program:    ${mintInfo.tokenProgramId.toBase58()}`);
    console.log(`  Decimals:         ${mintInfo.decimals}`);
    console.log(`  Supply:           ${mintInfo.supply.toString()}`);
    if (mintInfo.mintAuthority) {
      console.log(
        `  Mint Authority:   ${mintInfo.mintAuthority.toBase58()}${lbl(mintInfo.mintAuthority)}`
      );
      const ms = await readMultisigIfAny(connection, mintInfo.mintAuthority);
      if (ms) {
        console.log(`     └─ SPL Token multisig (threshold ${ms.m} of ${ms.n}):`);
        ms.signers.forEach((s, i) =>
          console.log(`        member ${i + 1}: ${s.toBase58()}${lbl(s)}`)
        );
      } else {
        console.log('     └─ (not an SPL multisig — plain wallet / PDA / Squads vault)');
      }
    } else {
      console.log('  Mint Authority:   none (fixed supply)');
    }
    console.log(
      `  Freeze Authority: ${mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toBase58() : 'none'}`
    );
    console.log('');

    // ── Pool state ───────────────────────────────────────────────────
    console.log(`═══ POOL STATE ═══`);
    const poolAcc = await connection.getAccountInfo(poolStatePda);
    if (!poolAcc) {
      console.log(`  ⚠️  Pool not initialized (no account at ${poolStatePda.toBase58()})`);
    } else {
      const s = deserializePoolState(poolAcc.data).config;
      const poolTokenExists = (await connection.getAccountInfo(s.poolTokenAccount)) !== null;
      console.log(`  Pool Config PDA:  ${poolStatePda.toBase58()}`);
      console.log(`  Owner:            ${s.owner.toBase58()}${lbl(s.owner)}`);
      console.log(
        `  Proposed Owner:   ${s.proposedOwner.equals(NONE) ? 'None' : s.proposedOwner.toBase58()}`
      );
      console.log(`  Rate Limit Admin: ${s.rateLimitAdmin.toBase58()}${lbl(s.rateLimitAdmin)}`);
      console.log(`  Pool Signer PDA:  ${s.poolSigner.toBase58()}${lbl(s.poolSigner)}`);
      console.log(
        `  Pool Token Acct:  ${s.poolTokenAccount.toBase58()} (exists: ${poolTokenExists ? 'yes ✅' : 'NO ⚠️'})`
      );
    }
    console.log('');

    // ── Token admin registry ─────────────────────────────────────────
    console.log('═══ TOKEN ADMIN REGISTRY ═══');
    const regAcc = await connection.getAccountInfo(registryPda);
    let lookupTable: PublicKey | null = null;
    let writableIndexes: number[] = [];
    if (!regAcc) {
      console.log(
        `  ⚠️  Token NOT registered with the CCIP router (no account at ${registryPda.toBase58()})`
      );
    } else {
      const reg = deserializeTokenAdminRegistry(regAcc.data);
      const layoutOk = reg.mint.equals(mint);
      console.log(`  Registry PDA:     ${registryPda.toBase58()}`);
      console.log(`  Version:          ${reg.version}`);
      console.log(`  Administrator:    ${reg.administrator.toBase58()}${lbl(reg.administrator)}`);
      console.log(
        `  Pending Admin:    ${reg.pendingAdministrator.equals(NONE) ? 'None' : reg.pendingAdministrator.toBase58()}`
      );
      const hasAlt = !reg.lookupTable.equals(NONE);
      console.log(
        `  Lookup Table:     ${hasAlt ? reg.lookupTable.toBase58() : 'None (set_pool not done)'}`
      );
      console.log(`  Writable Indexes: [${reg.writableIndexes.join(', ')}]`);
      console.log(`  Layout self-check (mint matches): ${layoutOk ? 'PASS ✅' : 'FAIL ❌'}`);
      if (hasAlt) lookupTable = reg.lookupTable;
      writableIndexes = reg.writableIndexes;
    }
    console.log('');

    // ── Address Lookup Table ─────────────────────────────────────────
    if (lookupTable) {
      console.log('═══ ADDRESS LOOKUP TABLE ═══');
      const altLabels = new Map<string, string>();
      if (feeQuoterProgramId) {
        const base = await deriveCcipBaseAddresses({
          connection,
          routerProgramId,
          feeQuoterProgramId,
          poolProgramId,
          tokenMint: mint,
          lookupTableAddress: lookupTable,
        });
        base.addresses.forEach((a, i) => altLabels.set(a.toBase58(), base.addressLabels[i] ?? ''));
      }
      const alt = await connection.getAddressLookupTable(lookupTable);
      const addrs = alt.value?.state.addresses ?? [];
      console.log(`  ${lookupTable.toBase58()} (${addrs.length} addresses)`);
      addrs.forEach((a, i) => {
        const w = writableIndexes.includes(i) ? ' [W]' : '';
        const role = altLabels.get(a.toBase58());
        console.log(
          `   ${String(i).padStart(2)}${w.padEnd(4)} ${a.toBase58()}${role ? `  ← ${role}` : ''}`
        );
      });
      console.log('');
    }

    console.log('✅ Inspection complete.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'inspectToken failed');
    if (error instanceof Error && error.stack) logger.error({ stack: error.stack }, 'Stack trace');
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}
