#!/usr/bin/env node
// check-packaged.mjs - the packaging gate.
//
// `cct-solana-tx docs` only finds anything because docs/ travels inside the tarball (package.json
// `files`). Nothing else notices when that breaks: drop "docs" from `files`, point `bin` somewhere
// else, or lose the shebang, and the build still succeeds, the tests still pass and the other three
// docs gates still go green. The damage shows up later, on someone else's machine, as an agent that
// cannot find the docs or a binary that exits without doing anything.
//
// So this gate checks what actually ships rather than what is in the working tree.
//
// Usage: node script/docs/check-packaged.mjs   (exit 1 on any problem)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8"));
const problems = [];

/** Every .ts file under a directory. */
function walkTs(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkTs(p));
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

// ---------- the bin entry ----------

const binNames = Object.keys(pkg.bin ?? {});
if (binNames.length === 0) {
  problems.push("package.json has no `bin` entry - the CLI cannot be installed globally");
} else if (binNames.length > 1) {
  problems.push(`package.json declares ${binNames.length} bins; the docs assume exactly one`);
}
const binName = binNames[0];
const binTarget = binName ? pkg.bin[binName] : null;
if (binTarget && !binTarget.startsWith("dist/")) {
  problems.push(`bin "${binName}" points at ${binTarget}, which is not build output under dist/`);
}

// Without a shebang the symlink npm creates on POSIX is not executable as a program.
const entrySrc = join(REPO, "src", "index.ts");
const entryText = existsSync(entrySrc) ? readFileSync(entrySrc, "utf8") : "";
if (entryText && !entryText.startsWith("#!/usr/bin/env node")) {
  problems.push("src/index.ts is missing the `#!/usr/bin/env node` shebang");
}

// The installed binary is reached through a symlink, so the entry-point guard has to compare real
// paths. Comparing argv directly makes an installed CLI do nothing at all, silently. Assert the fix
// is present rather than blacklisting spellings of the bug - the reversed and string-concatenated
// forms of that comparison are just as broken and a blacklist misses them.
if (entryText && !/realpathSync/.test(entryText)) {
  problems.push(
    "src/index.ts does not call realpathSync; the entry-point guard must compare resolved paths, " +
      "or a global install resolves the bin through a symlink, never matches, and exits silently"
  );
}

// `assert { type: 'json' }` was removed in Node 22 and throws a SyntaxError while loading. tsx
// still accepts it, so `pnpm bs58` and the test suite both stay green while every installed binary
// is dead on arrival. Nothing else in the repo runs the compiled output, so check the spelling.
for (const file of walkTs(join(REPO, "src"))) {
  if (/\bassert\s*\{\s*type\s*:/.test(readFileSync(file, "utf8"))) {
    problems.push(
      `${relative(REPO, file)} uses import assertions (\`assert { type: ... }\`), removed in ` +
        "Node 22. Use `with { type: 'json' }`."
    );
  }
}

// ---------- what actually ships ----------

let packed = [];
try {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  packed = (JSON.parse(out)[0]?.files ?? []).map((f) => f.path);
} catch (err) {
  problems.push(`could not run \`npm pack --dry-run\`: ${err.message}`);
}

if (packed.length > 0) {
  // Committed files that MUST ship for `<bin> docs` to work at all.
  const required = ["AGENTS.md", "docs/commands/catalog.json", "docs/index.md", "package.json"];
  for (const f of required) {
    if (!packed.includes(f)) problems.push(`${f} is not in the packed tarball (check package.json "files")`);
  }

  const pagesPacked = packed.filter((f) => f.startsWith("docs/") && f.endsWith(".md")).length;
  if (pagesPacked < 50) {
    problems.push(`only ${pagesPacked} docs pages are packed; expected the full docs tree`);
  }

  // dist/ is gitignored and built by `prepare`, so only assert it when a build is present.
  if (binTarget && existsSync(join(REPO, binTarget)) && !packed.includes(binTarget)) {
    problems.push(`${binTarget} exists but is not packed - the installed bin would dangle`);
  }
}

// ---------- the prepare script ----------

// `prepare` builds on `npm install`/`pnpm install` in a checkout and when this package is consumed
// as a git dependency. If it does not build, an install finishes happily and leaves `bin` pointing
// at a file that is not there. (Releases ship a prebuilt tarball, so users never run this.)
const prepare = pkg.scripts?.prepare ?? "";
if (!/\bbuild\b/.test(prepare)) {
  problems.push(`scripts.prepare (${JSON.stringify(prepare)}) does not build; git installs would ship no dist/`);
}

// ---------- report ----------

if (problems.length > 0) {
  console.error("packaging gate FAILED:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  `packaging gate: bin "${binName}" -> ${binTarget}; ` +
    `${packed.filter((f) => f.startsWith("docs/")).length} docs files ship with the build.`
);
