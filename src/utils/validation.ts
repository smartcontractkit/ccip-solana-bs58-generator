import { z } from 'zod';

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
 * Validate network connectivity to RPC endpoint
 * @param rpcUrl RPC URL to test
 * @param timeoutMs Timeout in milliseconds
 * @returns True if RPC is accessible
 */
export async function validateRpcConnectivity(
  rpcUrl: string,
  timeoutMs: number = 5000
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
