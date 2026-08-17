import { describe, it, expect } from 'vitest';
import {
  PROGRAM_REGISTRY,
  getProgramConfig,
  getIdlEnabledPrograms,
  type ProgramName,
} from '../src/types/program-registry.js';

describe('PROGRAM_REGISTRY shape', () => {
  it('has exactly burnmint-token-pool, lockrelease-token-pool, router', () => {
    expect(Object.keys(PROGRAM_REGISTRY).sort()).toEqual([
      'burnmint-token-pool',
      'lockrelease-token-pool',
      'router',
    ]);
  });

  it('every program has hasIdl:true and a non-empty idl', () => {
    for (const cfg of Object.values(PROGRAM_REGISTRY)) {
      expect(cfg.hasIdl).toBe(true);
      expect(cfg.idl).toBeDefined();
      expect((cfg.idl as { instructions?: unknown[] }).instructions).toBeDefined();
    }
  });
});

describe('burnmint supportedInstructions', () => {
  const expected = [
    'initialize',
    'acceptOwnership',
    'transferOwnership',
    'setRateLimitAdmin',
    'getState',
    'getChainConfig',
    'setChainRateLimit',
    'initChainRemoteConfig',
    'editChainRemoteConfig',
    'appendRemotePoolAddresses',
    'deleteChainConfig',
    'configureAllowList',
    'removeFromAllowList',
  ];
  it('matches the documented set', () => {
    expect(PROGRAM_REGISTRY['burnmint-token-pool'].supportedInstructions).toEqual(expected);
  });
});

describe('lockrelease supports the 4 instructions burnmint lacks', () => {
  const burnmint = new Set<string>(PROGRAM_REGISTRY['burnmint-token-pool'].supportedInstructions);
  const lockrelease = PROGRAM_REGISTRY['lockrelease-token-pool'].supportedInstructions;
  const extra = lockrelease.filter(i => !burnmint.has(i));

  it('the 4 lockrelease-specific instructions are present', () => {
    expect(extra.sort()).toEqual([
      'provideLiquidity',
      'setCanAcceptLiquidity',
      'setRebalancer',
      'withdrawLiquidity',
    ]);
  });

  it('lockrelease is a superset of burnmint', () => {
    for (const i of PROGRAM_REGISTRY['burnmint-token-pool'].supportedInstructions) {
      expect(lockrelease).toContain(i);
    }
  });
});

describe('router supportedInstructions', () => {
  it('includes the 5 router admin instructions', () => {
    const router = PROGRAM_REGISTRY['router'].supportedInstructions;
    for (const i of [
      'owner_propose_administrator',
      'owner_override_pending_administrator',
      'accept_admin_role_token_admin_registry',
      'transfer_admin_role_token_admin_registry',
      'set_pool',
    ]) {
      expect(router).toContain(i);
    }
  });
});

describe('getProgramConfig / getIdlEnabledPrograms', () => {
  it('getProgramConfig returns the config for a known program', () => {
    expect(getProgramConfig('burnmint-token-pool').name).toBe('burnmint-token-pool');
  });

  it('getIdlEnabledPrograms returns all 3', () => {
    expect(getIdlEnabledPrograms()).toHaveLength(3);
  });

  it('ProgramName union covers the 3 keys', () => {
    const names: ProgramName[] = ['burnmint-token-pool', 'lockrelease-token-pool', 'router'];
    for (const n of names) expect(PROGRAM_REGISTRY[n]).toBeDefined();
  });
});
