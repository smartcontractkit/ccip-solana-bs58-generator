import type { Idl } from './index.js';
import burnmintIdl from '../programs/burnmint-token-pool/idl.json' assert { type: 'json' };
import lockreleaseIdl from '../programs/lockrelease-token-pool/idl.json' assert { type: 'json' };
import routerIdl from '../programs/router/idl.json' assert { type: 'json' };

/**
 * Program configuration interface
 */
export interface ProgramConfig {
  name: string;
  displayName: string;
  description: string;
  hasIdl: boolean;
  idl?: Idl; // The actual IDL object
  supportedInstructions: string[];
}

/**
 * Registry of all supported programs
 */
export const PROGRAM_REGISTRY = {
  'burnmint-token-pool': {
    name: 'burnmint-token-pool',
    displayName: 'Burnmint Token Pool',
    description: 'CCIP Burnmint Token Pool Program',
    hasIdl: true,
    idl: burnmintIdl as unknown as Idl,
    supportedInstructions: [
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
    ],
  },
  'lockrelease-token-pool': {
    name: 'lockrelease-token-pool',
    displayName: 'Lockrelease Token Pool',
    description: 'CCIP Lockrelease Token Pool Program',
    hasIdl: true,
    idl: lockreleaseIdl as unknown as Idl,
    supportedInstructions: [
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
      'provideLiquidity',
      'withdrawLiquidity',
      'setCanAcceptLiquidity',
      'setRebalancer',
    ],
  },
  router: {
    name: 'router',
    displayName: 'CCIP Router',
    description: 'CCIP Router Program',
    hasIdl: true,
    idl: routerIdl as unknown as Idl,
    supportedInstructions: [
      'owner_propose_administrator',
      'owner_override_pending_administrator',
      'accept_admin_role_token_admin_registry',
      'transfer_admin_role_token_admin_registry',
      'set_pool',
    ],
  },
} as const satisfies Record<string, ProgramConfig>;

// Extract the program names as a union type for better DX
export type ProgramName = keyof typeof PROGRAM_REGISTRY;

/**
 * Get program configuration by name
 */
export function getProgramConfig(programName: ProgramName): ProgramConfig {
  return PROGRAM_REGISTRY[programName];
}

/**
 * Get programs that have IDL support
 */
export function getIdlEnabledPrograms(): ProgramConfig[] {
  return Object.values(PROGRAM_REGISTRY).filter(config => config.hasIdl);
}
