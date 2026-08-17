import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PACKAGE_VERSION,
  PACKAGE_NAME,
  BIN_NAME,
  PACKAGE_ROOT,
  DOCS_DIR,
  CATALOG_PATH,
  AGENTS_MD_PATH,
  UPSTREAM_DOCS_URL,
} from '../src/utils/package-info.js';
import { CLI_CONFIG } from '../src/utils/constants.js';

const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));

describe('package identity', () => {
  it('PACKAGE_VERSION matches package.json version', () => {
    expect(PACKAGE_VERSION).toBe(pkg.version);
  });

  it('PACKAGE_NAME is the expected scoped name', () => {
    expect(PACKAGE_NAME).toBe('@chainlink/ccip-solana-bs58-generator');
    expect(PACKAGE_NAME).toBe(pkg.name);
  });

  it('BIN_NAME is the first key of package.json bin', () => {
    expect(BIN_NAME).toBe('cct-solana-tx');
    expect(BIN_NAME).toBe(Object.keys(pkg.bin)[0]);
  });

  it('CLI_CONFIG reads version and name dynamically (not hardcoded)', () => {
    expect(CLI_CONFIG.VERSION).toBe(PACKAGE_VERSION);
    expect(CLI_CONFIG.NAME).toBe(BIN_NAME);
    // Guard the specific old hardcoded values the diff replaced.
    expect(CLI_CONFIG.VERSION).not.toBe('1.0.0');
    expect(CLI_CONFIG.NAME).not.toBe('ccip-bs58');
  });
});

describe('docs paths ship inside the package', () => {
  it('DOCS_DIR resolves to an existing directory', () => {
    expect(DOCS_DIR).not.toBeNull();
  });

  it('CATALOG_PATH resolves to an existing file', () => {
    expect(CATALOG_PATH).not.toBeNull();
  });

  it('AGENTS_MD_PATH resolves to an existing file', () => {
    expect(AGENTS_MD_PATH).not.toBeNull();
  });
});

describe('UPSTREAM_DOCS_URL is pinned to the current version tag', () => {
  it('contains /v<version>/docs', () => {
    expect(UPSTREAM_DOCS_URL).toContain(`/v${PACKAGE_VERSION}/docs`);
  });
});
