import { Buffer } from 'buffer';

/**
 * Normalize a hex string by removing an optional 0x prefix and lowercasing.
 */
export function normalizeHexString(input: string): string {
  const withoutPrefix = input.startsWith('0x') ? input.slice(2) : input;
  return withoutPrefix.toLowerCase();
}

/**
 * Convert a hex string (optionally 0x-prefixed) to a Buffer.
 */
export function hexToBytes(input: string): Buffer {
  const hex = normalizeHexString(input);
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error('Invalid hex string');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Left-pad a Buffer with zeros to the desired byte length.
 */
export function leftPad(buffer: Buffer, targetLength: number): Buffer {
  if (buffer.length > targetLength) {
    throw new Error(`Buffer longer than ${targetLength} bytes`);
  }
  if (buffer.length === targetLength) return buffer;
  return Buffer.concat([Buffer.alloc(targetLength - buffer.length, 0), buffer]);
}

/**
 * Convert a hex string (optionally 0x-prefixed) into a left-padded 32-byte Buffer.
 */
export function hexToPadded32Bytes(input: string): Buffer {
  const raw = hexToBytes(input);
  return leftPad(raw, 32);
}
