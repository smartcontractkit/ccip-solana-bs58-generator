import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveTransactionOutputFormat,
  parseTransactionOutputFormat,
  getEncodedTransactionData,
  DEFAULT_TRANSACTION_OUTPUT_FORMAT,
  TX_OUTPUT_FORMAT_ENV_VAR,
  TRANSACTION_OUTPUT_FORMATS,
} from '../src/utils/constants.js';

const ENV = TX_OUTPUT_FORMAT_ENV_VAR;

describe('parseTransactionOutputFormat', () => {
  it('is case-insensitive', () => {
    expect(parseTransactionOutputFormat('base58')).toBe('base58');
    expect(parseTransactionOutputFormat('BASE58')).toBe('base58');
    expect(parseTransactionOutputFormat('Base64')).toBe('base64');
  });

  it('returns null for unknown formats', () => {
    expect(parseTransactionOutputFormat('hex')).toBeNull();
    expect(parseTransactionOutputFormat('json')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseTransactionOutputFormat(undefined)).toBeNull();
  });
});

describe('resolveTransactionOutputFormat precedence', () => {
  beforeEach(() => {
    delete process.env[ENV];
  });
  afterEach(() => {
    delete process.env[ENV];
  });

  it('CLI --format wins over env', () => {
    process.env[ENV] = 'base58';
    expect(resolveTransactionOutputFormat('base64')).toEqual({ ok: true, format: 'base64' });
  });

  it('env wins when --format unset', () => {
    process.env[ENV] = 'base64';
    expect(resolveTransactionOutputFormat(undefined)).toEqual({ ok: true, format: 'base64' });
  });

  it('defaults to base58 when neither set', () => {
    expect(resolveTransactionOutputFormat(undefined)).toEqual({ ok: true, format: 'base58' });
    expect(DEFAULT_TRANSACTION_OUTPUT_FORMAT).toBe('base58');
  });

  it('rejects invalid CLI format with source:"cli"', () => {
    expect(resolveTransactionOutputFormat('hex')).toEqual({
      ok: false,
      source: 'cli',
      value: 'hex',
    });
  });

  it('rejects invalid env format with source:"env"', () => {
    process.env[ENV] = 'hex';
    expect(resolveTransactionOutputFormat(undefined)).toEqual({
      ok: false,
      source: 'env',
      value: 'hex',
    });
  });

  it('empty CLI string falls through to env/default', () => {
    process.env[ENV] = 'base64';
    expect(resolveTransactionOutputFormat('')).toEqual({ ok: true, format: 'base64' });
  });
});

describe('TRANSACTION_OUTPUT_FORMATS', () => {
  it('is exactly ["base58","base64"]', () => {
    expect([...TRANSACTION_OUTPUT_FORMATS]).toEqual(['base58', 'base64']);
  });
});

describe('getEncodedTransactionData', () => {
  const tx = { base58: 'b58blob', base64: 'b64blob' };

  it('returns base64 when format=base64', () => {
    expect(getEncodedTransactionData(tx, 'base64')).toBe('b64blob');
  });

  it('returns base58 when format=base58', () => {
    expect(getEncodedTransactionData(tx, 'base58')).toBe('b58blob');
  });

  it('defaults to base58', () => {
    expect(getEncodedTransactionData(tx)).toBe('b58blob');
  });
});
