import { Command } from 'commander';
import { createConnection } from './../../utils/connection.js';
import { PublicKey } from '@solana/web3.js';
import { validateArgs } from '../../utils/validation.js';
import { InspectTokenArgsSchema } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { emitJson, stateEnvelope } from '../../utils/json-output.js';
import { AccountDerivation as RouterDerivation } from '../../programs/router/accounts.js';
import { AccountDerivation as PoolDerivation } from '../../programs/burnmint-token-pool/accounts.js';
import { deserializeTokenAdminRegistry } from '../../programs/router/registry.js';
import { deserializePoolState } from '../../programs/shared/pool-state.js';
import { getAccount } from '@solana/spl-token';
import { readMint, readMultisigIfAny } from '../../utils/token.js';
import { deserializePoolConfig } from '../../programs/shared/pool-config.js';
import { deriveCcipBaseAddresses } from '../../utils/alt.js';

const NONE = PublicKey.default; // 11111111111111111111111111111111

/**
 * Read-only auditor for one mint, to check a deployment's governance config: the mint authority
 * (including SPL multisig members) and Token-2022 extensions, the pool state and its token account,
 * the pool program's global config, the CCIP token admin registry, and the ALT.
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
    const connection = createConnection(rpc);

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

    // Built alongside the printing rather than replacing it, so the human output is untouched.
    // Absent values are null here, never the "None" the display prints.
    const report: Record<string, unknown> = {
      mint: mint.toBase58(),
      routerProgramId: routerProgramId.toBase58(),
      poolProgramId: poolProgramId.toBase58(),
      derived: {
        poolStatePda: poolStatePda.toBase58(),
        poolSignerPda: poolSignerPda.toBase58(),
        registryPda: registryPda.toBase58(),
      },
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
    const mintAuthorityMultisig = mintInfo.mintAuthority
      ? await readMultisigIfAny(connection, mintInfo.mintAuthority)
      : null;
    if (mintInfo.mintAuthority) {
      console.log(
        `  Mint Authority:   ${mintInfo.mintAuthority.toBase58()}${lbl(mintInfo.mintAuthority)}`
      );
      const ms = mintAuthorityMultisig;
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

    report.mintAccount = {
      tokenProgram: mintInfo.tokenProgramId.toBase58(),
      decimals: mintInfo.decimals,
      supply: mintInfo.supply.toString(),
      mintAuthority: mintInfo.mintAuthority ? mintInfo.mintAuthority.toBase58() : null,
      mintAuthorityMultisig: mintAuthorityMultisig
        ? {
            threshold: mintAuthorityMultisig.m,
            total: mintAuthorityMultisig.n,
            signers: mintAuthorityMultisig.signers.map(s => s.toBase58()),
          }
        : null,
      freezeAuthority: mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toBase58() : null,
      extensions: mintInfo.extensions,
    };

    // ── Pool state ───────────────────────────────────────────────────
    console.log(`═══ POOL STATE ═══`);
    const poolAcc = await connection.getAccountInfo(poolStatePda);
    if (!poolAcc) {
      console.log(`  ⚠️  Pool not initialized (no account at ${poolStatePda.toBase58()})`);
      // Same keys whether or not the pool exists, so a consumer reads fields rather than probing
      // for their existence.
      report.pool = {
        initialized: false,
        statePda: poolStatePda.toBase58(),
        owner: null,
        proposedOwner: null,
        rateLimitAdmin: null,
        poolSigner: null,
        poolTokenAccount: null,
        poolTokenAccountExists: false,
      };
    } else {
      const s = deserializePoolState(poolAcc.data).config;
      // Decode the pool's token account instead of only checking that it exists: same request, and
      // it carries the balance, the delegate and the frozen flag. A delegate here is not part of
      // normal operation, and for a lock/release pool this account holds the liquidity.
      const poolToken = await getAccount(
        connection,
        s.poolTokenAccount,
        undefined,
        mintInfo.tokenProgramId
      ).catch(() => null);
      const poolTokenExists = poolToken !== null;
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
      report.pool = {
        initialized: true,
        statePda: poolStatePda.toBase58(),
        owner: s.owner.toBase58(),
        proposedOwner: s.proposedOwner.equals(NONE) ? null : s.proposedOwner.toBase58(),
        rateLimitAdmin: s.rateLimitAdmin.toBase58(),
        poolSigner: s.poolSigner.toBase58(),
        poolTokenAccount: s.poolTokenAccount.toBase58(),
        poolTokenAccountExists: poolTokenExists,
        poolTokenBalance: poolToken ? poolToken.amount.toString() : null,
        poolTokenDelegate: poolToken?.delegate ? poolToken.delegate.toBase58() : null,
        poolTokenDelegatedAmount: poolToken?.delegate ? poolToken.delegatedAmount.toString() : null,
        poolTokenFrozen: poolToken ? poolToken.isFrozen : null,
      };
    }
    console.log('');

    // ── Pool program global config ───────────────────────────────────
    // Program-wide, not per-token; see `pool-config.ts` for what these fields govern.
    const [globalConfigPda] = PoolDerivation.deriveGlobalConfigPda(poolProgramId);
    const cfgAcc = await connection.getAccountInfo(globalConfigPda);
    if (cfgAcc) {
      const cfg = deserializePoolConfig(cfgAcc.data);
      console.log('═══ POOL PROGRAM CONFIG ═══');
      console.log(`  Config PDA:       ${globalConfigPda.toBase58()}`);
      console.log(`  Version:          ${cfg.version}`);
      console.log(`  Self-served:      ${cfg.selfServedAllowed}`);
      console.log(`  Default Router:   ${cfg.router.toBase58()}`);
      console.log(`  Default RMN:      ${cfg.rmnRemote.toBase58()}`);
      console.log('');
      report.poolProgramConfig = {
        configPda: globalConfigPda.toBase58(),
        version: cfg.version,
        selfServedAllowed: cfg.selfServedAllowed,
        defaultRouter: cfg.router.toBase58(),
        defaultRmnRemote: cfg.rmnRemote.toBase58(),
      };
    } else {
      report.poolProgramConfig = null;
    }

    // ── Token admin registry ─────────────────────────────────────────
    console.log('═══ TOKEN ADMIN REGISTRY ═══');
    const regAcc = await connection.getAccountInfo(registryPda);
    let lookupTable: PublicKey | null = null;
    let writableIndexes: number[] = [];
    if (!regAcc) {
      console.log(
        `  ⚠️  Token NOT registered with the CCIP router (no account at ${registryPda.toBase58()})`
      );
      report.registry = { registered: false, registryPda: registryPda.toBase58() };
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
      report.registry = {
        registered: true,
        registryPda: registryPda.toBase58(),
        version: reg.version,
        administrator: reg.administrator.toBase58(),
        pendingAdministrator: reg.pendingAdministrator.equals(NONE)
          ? null
          : reg.pendingAdministrator.toBase58(),
        lookupTable: hasAlt ? reg.lookupTable.toBase58() : null,
        writableIndexes: reg.writableIndexes,
        // The registry PDA is derived from the mint, so a mismatch means the layout this tool
        // deserializes with no longer matches the on-chain account.
        layoutSelfCheckPassed: layoutOk,
      };
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
      // set_pool checked this table once, but the router deserializes it on every send and passes
      // every address in it to the pool. So whoever still holds the ALT authority can append
      // accounts to that call. `authority: null` means the table is frozen and nobody can.
      const altState = alt.value?.state;
      report.addressLookupTable = {
        address: lookupTable.toBase58(),
        authority: altState?.authority ? altState.authority.toBase58() : null,
        frozen: altState ? altState.authority === undefined : null,
        // u64::MAX is the never-deactivated sentinel; report an active table as null rather than
        // making every caller recognise 18446744073709551615.
        deactivationSlot:
          altState && altState.deactivationSlot.toString() !== '18446744073709551615'
            ? altState.deactivationSlot.toString()
            : null,
        addressCount: addrs.length,
        addresses: addrs.map((a, i) => ({
          index: i,
          address: a.toBase58(),
          writable: writableIndexes.includes(i),
          role: altLabels.get(a.toBase58()) || null,
        })),
      };
    } else {
      report.addressLookupTable = null;
    }

    console.log('✅ Inspection complete.');

    if ((global as { json?: boolean }).json) {
      emitJson(stateEnvelope({ kind: 'token-inspection', globalOptions: global, data: report }));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'inspectToken failed');
    if (error instanceof Error && error.stack) logger.error({ stack: error.stack }, 'Stack trace');
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}
