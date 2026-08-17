/**
 * `docs` - find and read the documentation that shipped with this build.
 *
 * `--path` is the primary entry point: it hands back a real directory the caller greps and reads
 * with its own tools. Printing a page to stdout is the fallback, for a human who wants one page.
 */

import { Command } from 'commander';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import {
  AGENTS_MD_PATH,
  BIN_NAME,
  CATALOG_PATH,
  DOCS_DIR,
  PACKAGE_NAME,
  PACKAGE_ROOT,
  PACKAGE_VERSION,
  UPSTREAM_DOCS_URL,
} from '../utils/package-info.js';

/** Every Markdown file under the docs directory, as slash-separated paths relative to it. */
function listTopics(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) out.push(relative(root, full).split(sep).join('/'));
    }
  };
  walk(root);
  return out.sort();
}

/**
 * Turn a topic into a file. Accepts `gotchas`, `gotchas/index`, `gotchas/index.md` and
 * `concepts/encoding` alike, so nobody has to know which pages happen to be directory indexes.
 *
 * The topic is untrusted input - often a string an agent assembled from somewhere else - and this
 * function turns it into a file read. `..` segments survive path joining, so without the
 * containment check below `docs ../../.config/solana/id.json` prints a keypair. Two rules: the
 * resolved path has to stay inside the docs tree, and it has to be a page (.md) or the catalog.
 */
function resolveTopic(root: string, topic: string): string | null {
  const cleaned = topic.replace(/^\/+|\/+$/g, '');
  const candidates = [cleaned, `${cleaned}.md`, `${cleaned}/index.md`, `${cleaned}/_index.md`];
  const boundary = resolve(root) + sep;
  for (const candidate of candidates) {
    const full = resolve(root, ...candidate.split('/'));
    if (!full.startsWith(boundary)) continue;
    if (!full.endsWith('.md') && !full.endsWith('.json')) continue;
    if (existsSync(full) && statSync(full).isFile()) return full;
  }
  return null;
}

/**
 * This command's output IS the result, so it goes to stdout directly.
 *
 * `console.log` is not safe here: the global `--json` flag redirects it to stderr, and commander
 * routes `--json` to the root program even when it is written after the subcommand - so
 * `docs --json` would redirect itself and print the manifest to the wrong stream.
 */
function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Shown when the docs did not ship - an old build, or someone dropped `docs` from `files`. */
function missingDocs(): never {
  console.error(`❌ No packaged docs found in ${PACKAGE_ROOT}`);
  console.error(`💡 This build shipped without docs/. Read them online instead:`);
  console.error(`   ${UPSTREAM_DOCS_URL}`);
  process.exit(1);
}

export function createDocsCommand(): Command {
  const command = new Command('docs');

  command
    .description('locate or print the documentation packaged with this build')
    .argument('[topic]', 'page to print, e.g. gotchas, concepts/encoding, commands/router/set-pool')
    .option('--path', 'print only the absolute path to the docs directory')
    .option('--json', 'print a machine-readable manifest (version, paths, upstream)')
    .option('--list', 'list every available topic')
    .addHelpText(
      'after',
      `
Examples:
  $ ${BIN_NAME} docs --path            # absolute docs directory, for agents and scripts
  $ ${BIN_NAME} docs --json            # manifest: version, docs path, catalog path
  $ ${BIN_NAME} docs --list            # every available page
  $ ${BIN_NAME} docs gotchas           # print a page to stdout
`
    )
    .action((topic: string | undefined, options: Record<string, boolean>, cmd?: Command) => {
      // `--json` is declared both here and globally, and commander binds it to the root program
      // wherever it appears. Read both, so `docs --json` and `--json docs` mean the same thing
      // instead of the second one silently falling through to the human summary.
      const wantsJson =
        options.json === true ||
        (cmd?.parent?.opts() as { json?: boolean } | undefined)?.json === true;

      // The agent entry point: one line, no decoration, safe to capture in a shell variable.
      if (options.path) {
        if (!DOCS_DIR) missingDocs();
        out(DOCS_DIR);
        return;
      }

      if (wantsJson) {
        out(
          JSON.stringify(
            {
              name: PACKAGE_NAME,
              bin: BIN_NAME,
              version: PACKAGE_VERSION,
              packageRoot: PACKAGE_ROOT,
              docsPath: DOCS_DIR,
              catalogPath: CATALOG_PATH,
              routerPath: AGENTS_MD_PATH,
              upstream: UPSTREAM_DOCS_URL,
              docsShipped: DOCS_DIR !== null,
            },
            null,
            2
          )
        );
        return;
      }

      if (!DOCS_DIR) missingDocs();

      if (options.list) {
        for (const t of listTopics(DOCS_DIR)) out(t);
        return;
      }

      if (topic) {
        const file = resolveTopic(DOCS_DIR, topic);
        if (!file) {
          console.error(`❌ No such topic: ${topic}`);
          console.error(`💡 List everything available: ${BIN_NAME} docs --list`);
          process.exit(1);
        }
        process.stdout.write(readFileSync(file, 'utf8'));
        return;
      }

      // Bare `docs`: point a human at the right place without dumping 3,800 lines on them.
      out(`${PACKAGE_NAME} v${PACKAGE_VERSION}`);
      out('');
      out(`Docs directory : ${DOCS_DIR}`);
      if (CATALOG_PATH) out(`Command catalog: ${CATALOG_PATH}`);
      if (AGENTS_MD_PATH) out(`Agent router   : ${AGENTS_MD_PATH}`);
      out('');
      out(`${listTopics(DOCS_DIR).length} pages. Next:`);
      out(`  ${BIN_NAME} docs --list        # every page`);
      out(`  ${BIN_NAME} docs gotchas       # print one`);
      out(`  ${BIN_NAME} docs --path        # just the directory (for agents/scripts)`);
    });

  return command;
}
