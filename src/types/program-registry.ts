import type { Idl } from './index.js';
import burnmintIdl from '../programs/burnmint-token-pool/idl.json' assert { type: 'json' };

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
    supportedInstructions: ['acceptOwnership'],
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
