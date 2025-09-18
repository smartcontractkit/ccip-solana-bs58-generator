import { z } from 'zod';
import { Connection } from '@solana/web3.js';

/**
 * Validate that a string is a valid URL
 * @param value String to validate
 * @returns True if valid URL
 */
export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate command line arguments with detailed error messages
 * @param schema Zod schema to validate against
 * @param data Data to validate
 * @returns Validation result with success flag and data or errors
 */
export function validateArgs<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map(err => {
    const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
    return `${path}${err.message}`;
  });

  return { success: false, errors };
}

/**
 * Validate network connectivity to RPC endpoint using Solana's built-in retry logic
 * @param rpcUrl RPC URL to test
 * @returns True if RPC is accessible
 */
export async function validateRpcConnectivity(rpcUrl: string): Promise<boolean> {
  try {
    console.debug('🔄 Testing RPC connectivity...');

    // Create connection that will use Solana's built-in retry logic
    // Note: Solana web3.js has built-in retry with 5 attempts and exponential backoff (500ms → 1s → 2s → 4s → 8s)
    const connection = new Connection(rpcUrl);

    // Make a simple RPC call that will trigger Solana's retry logic if needed
    await connection.getSlot();

    return true;
  } catch {
    return false;
  }
}
