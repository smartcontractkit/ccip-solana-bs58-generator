import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Keypair, PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { finalizeTransaction } from '../src/utils/finalize-transaction.js';
import * as jsonOutput from '../src/utils/json-output.js';
import { TransactionDisplay } from '../src/utils/display.js';
import * as txExecutor from '../src/utils/transaction-executor.js';
import * as keypairUtil from '../src/utils/keypair.js';
import type { GeneratedTransaction } from '../src/types/index.js';
import type { TransactionBuilder } from '../src/core/transaction-builder.js';
import type { CommandContext, GlobalCommandOptions } from '../src/types/command.js';

/** A minimal TransactionBuilder stub satisfying the shape finalizeTransaction uses. */
interface StubTransactionBuilder {
  buildTransaction: ReturnType<typeof vi.fn>;
  simulateSignedTransaction: ReturnType<typeof vi.fn>;
}

/** Build a stubbed TransactionBuilder that returns the given tx and signed-sim result. */
function stubbedBuilder(
  tx: GeneratedTransaction,
  signedSim: { success: boolean; error?: string }
): StubTransactionBuilder {
  return {
    buildTransaction: vi.fn().mockResolvedValue(tx),
    simulateSignedTransaction: vi.fn().mockResolvedValue(signedSim),
  };
}

/** A command-like object whose parent.opts() returns the given globals (one level up). */
function cmdWithGlobals(globals: GlobalCommandOptions): CommandContext {
  return { parent: { opts: () => globals } };
}

const PAYER = Keypair.generate();
const MINT = Keypair.generate().publicKey;

function fakeTx(simSuccess: boolean, simError?: string): GeneratedTransaction {
  return {
    instruction: 'accept-ownership',
    base58: 'b58',
    base64: 'b64',
    hex: '686578',
    accounts: [{ pubkey: PAYER.publicKey.toBase58(), isSigner: true, isWritable: true }],
    details: {
      programId: 'prog',
      instructionData: '00',
      instructions: [{ programId: 'prog', data: '00', accounts: [] }],
      signers: [PAYER.publicKey.toBase58()],
      writableAccounts: [PAYER.publicKey.toBase58()],
      readOnlyAccounts: [],
      feePayer: PAYER.publicKey.toBase58(),
      accountSummary: { total: 1, signers: 1, writable: 1, readOnly: 0 },
    },
    metadata: {
      generatedAt: '2026-01-01T00:00:00.000Z',
      computeUnits: 100,
      simulationSuccess: simSuccess,
      ...(simError ? { simulationError: simError } : {}),
    },
  };
}

function simpleIx(): TransactionInstruction {
  return SystemProgram.transfer({
    fromPubkey: PAYER.publicKey,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1,
  });
}

let emitSpy: ReturnType<typeof vi.spyOn>;
let displayResultsSpy: ReturnType<typeof vi.spyOn>;
let displayBannerSpy: ReturnType<typeof vi.spyOn>;
let displayExecResultsSpy: ReturnType<typeof vi.spyOn>;
let executeSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  emitSpy = vi.spyOn(jsonOutput, 'emitJson').mockImplementation(() => {});
  displayResultsSpy = vi.spyOn(TransactionDisplay, 'displayResults').mockImplementation(() => {});
  displayBannerSpy = vi
    .spyOn(TransactionDisplay, 'displayExecutionBanner')
    .mockImplementation(() => {});
  displayExecResultsSpy = vi
    .spyOn(TransactionDisplay, 'displayExecutionResults')
    .mockImplementation(() => {});
  executeSpy = vi.spyOn(txExecutor, 'executeTransaction').mockResolvedValue('sig123');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('non-execute mode', () => {
  it('human path: calls displayResults with the resolved format', async () => {
    const tb = stubbedBuilder(fakeTx(true), { success: true });
    await finalizeTransaction({
      txBuilder: tb as unknown as TransactionBuilder,
      instructions: [simpleIx()],
      payer: PAYER.publicKey,
      instructionName: 'accept-ownership',
      command: cmdWithGlobals({
        resolvedRpcUrl: 'https://api.devnet.solana.com',
        format: 'base58',
      }),
    });
    expect(displayResultsSpy).toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('json path: emits transactionEnvelope with execution:null, does NOT call displayResults', async () => {
    const tb = stubbedBuilder(fakeTx(true), { success: true });
    await finalizeTransaction({
      txBuilder: tb as unknown as TransactionBuilder,
      instructions: [simpleIx()],
      payer: PAYER.publicKey,
      instructionName: 'accept-ownership',
      command: cmdWithGlobals({
        resolvedRpcUrl: 'https://api.devnet.solana.com',
        format: 'base58',
        json: true,
        environment: 'devnet',
      }),
    });
    expect(emitSpy).toHaveBeenCalled();
    expect(displayResultsSpy).not.toHaveBeenCalled();
    // The envelope's execution block is the non-executed shape.
    const payload = emitSpy.mock.calls[0]![0] as { execution: { executed: boolean } };
    expect(payload.execution.executed).toBe(false);
  });
});

describe('execute mode guards', () => {
  it('throws if keypair !== payer', async () => {
    const tb = stubbedBuilder(fakeTx(true), { success: true });
    const otherKeypair = Keypair.generate();
    // Force loadSignerKeypair to return a keypair whose pubkey differs from payer.
    const loadSpy = vi.spyOn(keypairUtil, 'loadSignerKeypair').mockReturnValue(otherKeypair);
    await expect(
      finalizeTransaction({
        txBuilder: tb as unknown as TransactionBuilder,
        instructions: [simpleIx()],
        payer: PAYER.publicKey,
        instructionName: 'x',
        command: cmdWithGlobals({
          resolvedRpcUrl: 'https://api.devnet.solana.com',
          execute: true,
          keypair: '/k.json',
        }),
      })
    ).rejects.toThrow(/Keypair does not match --authority/);
    loadSpy.mockRestore();
  });

  it('throws if simulation failed (sim-gate before send)', async () => {
    const tb = stubbedBuilder(fakeTx(false, 'custom program error: 0x1772'), { success: true });
    const loadSpy = vi.spyOn(keypairUtil, 'loadSignerKeypair').mockReturnValue(PAYER);
    await expect(
      finalizeTransaction({
        txBuilder: tb as unknown as TransactionBuilder,
        instructions: [simpleIx()],
        payer: PAYER.publicKey,
        instructionName: 'x',
        command: cmdWithGlobals({
          resolvedRpcUrl: 'https://api.devnet.solana.com',
          execute: true,
          keypair: '/k.json',
        }),
      })
    ).rejects.toThrow(/Transaction simulation failed/);
    loadSpy.mockRestore();
  });

  it('throws if simulateSignedTransaction fails (sigVerify re-sim)', async () => {
    const tb = stubbedBuilder(fakeTx(true), { success: false, error: 'missing signer' });
    const loadSpy = vi.spyOn(keypairUtil, 'loadSignerKeypair').mockReturnValue(PAYER);
    await expect(
      finalizeTransaction({
        txBuilder: tb as unknown as TransactionBuilder,
        instructions: [simpleIx()],
        payer: PAYER.publicKey,
        instructionName: 'x',
        command: cmdWithGlobals({
          resolvedRpcUrl: 'https://api.devnet.solana.com',
          execute: true,
          keypair: '/k.json',
        }),
      })
    ).rejects.toThrow(/Signature verification failed/);
    loadSpy.mockRestore();
  });
});

describe('execute mode success', () => {
  it('human path: calls displayExecutionBanner + displayExecutionResults', async () => {
    const tb = stubbedBuilder(fakeTx(true), { success: true });
    const loadSpy = vi.spyOn(keypairUtil, 'loadSignerKeypair').mockReturnValue(PAYER);
    await finalizeTransaction({
      txBuilder: tb as unknown as TransactionBuilder,
      instructions: [simpleIx()],
      payer: PAYER.publicKey,
      instructionName: 'x',
      command: cmdWithGlobals({
        resolvedRpcUrl: 'https://api.devnet.solana.com',
        execute: true,
        keypair: '/k.json',
        environment: 'devnet',
      }),
    });
    expect(displayBannerSpy).toHaveBeenCalled();
    expect(displayExecResultsSpy).toHaveBeenCalled();
    expect(executeSpy).toHaveBeenCalled();
    loadSpy.mockRestore();
  });

  it('json path: emits envelope with execution block filled (signature, signer, explorerUrl)', async () => {
    const tb = stubbedBuilder(fakeTx(true), { success: true });
    const loadSpy = vi.spyOn(keypairUtil, 'loadSignerKeypair').mockReturnValue(PAYER);
    await finalizeTransaction({
      txBuilder: tb as unknown as TransactionBuilder,
      instructions: [simpleIx()],
      payer: PAYER.publicKey,
      instructionName: 'x',
      command: cmdWithGlobals({
        resolvedRpcUrl: 'https://api.devnet.solana.com',
        execute: true,
        keypair: '/k.json',
        environment: 'devnet',
        json: true,
        format: 'base58',
      }),
    });
    expect(emitSpy).toHaveBeenCalled();
    const payload = emitSpy.mock.calls[0]![0] as {
      execution: {
        executed: boolean;
        signature: string;
        signer: string;
        explorerUrl: string | null;
      };
    };
    expect(payload.execution.executed).toBe(true);
    expect(payload.execution.signature).toBe('sig123');
    expect(payload.execution.signer).toBe(PAYER.publicKey.toBase58());
    expect(payload.execution.explorerUrl).toContain('?cluster=devnet');
    loadSpy.mockRestore();
  });
});
