/**
 * Where the CLI's own identity comes from: name, version and docs location, all read from
 * package.json at runtime instead of copied into literals. A version bump or a `bin` rename then
 * cannot disagree with what `--version` and `docs --json` report.
 *
 * The package root is found by walking up from this module, which lands in the right place both
 * from `dist/utils/` (installed) and `src/utils/` (tsx, in-repo).
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageJson {
  name?: string;
  version?: string;
  bin?: Record<string, string>;
  description?: string;
  repository?: string | { url?: string };
}

const PACKAGE_ID = '@chainlink/ccip-solana-bs58-generator';

/**
 * Walk up from this module to the directory holding OUR package.json.
 *
 * The name check is the point. If someone vendors `dist/` into another project, the walk would
 * otherwise reach that project's package.json and quietly adopt it: the wrong version in
 * `--version`, the host's first `bin` in every help example, and `docs --list` printing the host's
 * Markdown. Reading a name we do not recognise means the layout is not what we think it is, so stop
 * and say which file was found rather than serving confident nonsense.
 */
function findPackageRoot(): string {
  const start = dirname(fileURLToPath(import.meta.url));
  let dir = start;
  for (;;) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      const name: unknown = JSON.parse(readFileSync(candidate, 'utf8')).name;
      if (name === PACKAGE_ID) return dir;
      throw new Error(
        `Expected ${PACKAGE_ID} but the nearest package.json (${candidate}) belongs to ` +
          `${String(name)}. The CLI cannot locate its own version or docs from here.`
      );
    }
    const parent = resolve(dir, '..');
    if (parent === dir) {
      throw new Error(
        `No package.json found above ${start}; ${PACKAGE_ID} install looks incomplete.`
      );
    }
    dir = parent;
  }
}

export const PACKAGE_ROOT = findPackageRoot();

const pkg: PackageJson = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));

/** Package version, e.g. "0.5.0". Deliberately 0.x - see the versioning note in AGENTS.md. */
export const PACKAGE_VERSION = pkg.version ?? '0.0.0';

/** Full package name, e.g. "@chainlink/ccip-solana-bs58-generator". */
export const PACKAGE_NAME = pkg.name ?? 'unknown';

/**
 * The command users actually type. Read from the `bin` map, so renaming the binary in package.json
 * renames it in help text, generated docs and the docs gate too.
 */
export const BIN_NAME = Object.keys(pkg.bin ?? {})[0] ?? 'cct-solana-tx';

/** The packaged docs directory, or null if `docs/` was dropped from package.json `files`. */
export const DOCS_DIR: string | null = (() => {
  const dir = join(PACKAGE_ROOT, 'docs');
  return existsSync(dir) ? dir : null;
})();

/** The machine-readable command catalog, or null if the docs did not ship. */
export const CATALOG_PATH: string | null = (() => {
  if (!DOCS_DIR) return null;
  const p = join(DOCS_DIR, 'commands', 'catalog.json');
  return existsSync(p) ? p : null;
})();

/** The agent-facing router, or null if it did not ship. */
export const AGENTS_MD_PATH: string | null = (() => {
  const p = join(PACKAGE_ROOT, 'AGENTS.md');
  return existsSync(p) ? p : null;
})();

/** The same docs on GitHub, pinned at this version's tag. Only useful if the packaged docs are missing. */
export const UPSTREAM_DOCS_URL = `https://github.com/smartcontractkit/ccip-solana-bs58-generator/tree/v${PACKAGE_VERSION}/docs`;
