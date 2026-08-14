#!/usr/bin/env node
// gen-catalog.mjs - generates the per-instruction command catalog from the commander source.
//
// Source of truth: src/commands/<prog>/index.ts (program name, alias, instruction list, flags) and
// the per-instruction handler files (JSDoc first sentence as description). Authored context that
// cannot be derived from code (preconditions, Squads notes, failure modes) lives in
// docs/commands/_meta.json and is merged in.
//
// Outputs (all under docs/commands/): catalog.json, index.md, <program>/<instruction>.md.
// Usage: node script/docs/gen-catalog.mjs            (write)
//        node script/docs/gen-catalog.mjs --check    (exit 1 if outputs are stale)

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(REPO, "src", "commands");
const OUT = join(REPO, "docs", "commands");
const CHECK = process.argv.includes("--check");

// The invocation shown in every generated example. Read from package.json `bin` so renaming the
// binary regenerates the docs instead of leaving stale command names behind in 50+ pages.
export const BIN = Object.keys(
  JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")).bin ?? {}
)[0];
if (!BIN) throw new Error("package.json has no `bin` entry - the docs cannot name the command");

// ---------- parse helpers ----------

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

// All .option()/.requiredOption() calls of a commander chain: flag, placeholder, description, and
// the instruction its `// <name> specific options` section comment scopes it to (if any). That
// comment is the authoritative grouping; help text alone puts create-mint flags on every page.
// Resolve the `${...}` interpolations used in option descriptions against src/utils/constants.ts,
// so the catalog's global flags stay derived from source rather than restated here.
let constantsSrc = null;
function resolveTemplate(tpl) {
  constantsSrc ??= readFileSync(join(REPO, "src", "utils", "constants.ts"), "utf8");
  return tpl.replace(/\$\{([^}]+)\}/g, (_, expr) => {
    // Object.keys(NAME).join('|')  ->  the object's keys
    let m = expr.match(/Object\.keys\((\w+)\)\.join\('([^']*)'\)/);
    if (m) {
      const body = constantsSrc.match(new RegExp(`${m[1]}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
      return [...body.matchAll(/^\s*(\w+)\s*:/gm)].map((k) => k[1].toLowerCase()).join(m[2]);
    }
    // NAME.join('|')  ->  the array's string entries
    m = expr.match(/(\w+)\.join\('([^']*)'\)/);
    if (m) {
      const body = constantsSrc.match(new RegExp(`${m[1]}\\s*=\\s*\\[([^\\]]*)\\]`))?.[1] ?? "";
      return [...body.matchAll(/'([^']+)'/g)].map((v) => v[1]).join(m[2]);
    }
    // A bare constant reference, defined as a string or a template literal
    m = expr.trim().match(/^\w+$/);
    if (m) {
      const name = expr.trim();
      const lit = constantsSrc.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`))?.[1];
      if (lit) return lit;
      const tpl = constantsSrc.match(new RegExp(`${name}\\s*=\\s*\`([^\`]*)\``))?.[1];
      // os.homedir() is machine-specific; render it as ~ rather than baking in a path
      if (tpl) return tpl.replace(/\$\{os\.homedir\(\)\}/g, "~").replace(/\$\{[^}]+\}/g, "");
    }
    return `<${expr.trim()}>`;
  });
}

function parseOptions(src) {
  // Section markers first, by position, so each option can be attributed to the section above it.
  // Only a marker naming a real instruction (kebab or camel) scopes anything.
  const sections = [...src.matchAll(/\/\/\s*([A-Za-z][\w\-\/ ]*?)\s+specific options/g)].map((m) => ({
    at: m.index,
    // a section may scope a flag to several instructions: "a / b specific options"
    names: m[1]
      .split("/")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => (/[A-Z]/.test(n) ? kebabName(n) : n)),
  }));
  const sectionAt = (pos) => [...sections].reverse().find((s) => s.at < pos)?.names ?? null;

  const opts = [];
  // Descriptions are single-quoted or template literals; the latter interpolate constants.
  const re = /\.(requiredOption|option)\(\s*'([^']+)'\s*,\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([^`]*)`)/g;
  for (const m of src.matchAll(re)) {
    const flags = m[2];
    if (flags.includes("--instruction")) continue;
    const flag = flags.match(/--[\w-]+/)?.[0] ?? flags;
    const arg = flags.match(/<([^>]+)>/)?.[1] ?? null;
    opts.push({
      flag,
      arg,
      required: m[1] === "requiredOption",
      description: m[3] ?? m[4] ?? resolveTemplate(m[5]),
      sections: sectionAt(m.index),
    });
  }
  return opts;
}
const kebabName = (camel) => camel.replace(/([A-Z])/g, "-$1").toLowerCase();

// Expand "a/b-tail" shorthand ("provide/withdraw-liquidity") into the full instruction names, so
// help text written for humans still matches machine-side.
function expandShorthand(desc) {
  return desc.replace(/\b([a-z]+)\/([a-z]+)((?:-[a-z]+)+)\b/g, (_, a, b, tail) => `${a}${tail} ${b}${tail}`);
}

// JSDoc (or leading line comments) immediately above the first exported symbol of a handler file.
function handlerDescription(file) {
  if (!existsSync(file)) return null;
  const src = readFileSync(file, "utf8");
  const jsdoc = src.match(/\/\*\*([\s\S]*?)\*\//);
  if (jsdoc) {
    const text = jsdoc[1]
      .split("\n")
      .map((l) => l.replace(/^\s*\*\s?/, "").trim())
      .filter((l) => l && !l.startsWith("@"))
      .join(" ");
    if (text) return text;
  }
  return null;
}

// Map an instruction name to its handler file (exact kebab match, then word-set match).
function handlerFile(dir, instruction) {
  const exact = join(dir, `${instruction}.ts`);
  if (existsSync(exact)) return exact;
  const want = instruction.split("-").sort().join("-");
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".ts") || f === "index.ts") continue;
    if (f.replace(/\.ts$/, "").split("-").sort().join("-") === want) return join(dir, f);
  }
  return null;
}

function classify(program, instruction, meta) {
  const m = meta[`${program}/${instruction}`] ?? {};
  if (typeof m.read_only === "boolean") return m.read_only;
  return /^(get-|inspect-|derive-)/.test(instruction);
}

// Which flags apply to an instruction: the description names it (word-boundary, so "mint" never
// matches "create-mint"), or the flag names no other instruction of the program (generic flag).
function mentionsInstruction(desc, instruction) {
  // "mint" is both an instruction name and a common noun; drop the noun phrases first so
  // "New mint authority (for transfer-mint-authority)" is not read as naming the mint instruction.
  const d = desc.replace(/\bmint (authority|address|account|program)\b/g, "$1");
  return new RegExp(`(^|[^\\w-])${instruction}([^\\w-]|$)`).test(d);
}
function flagsFor(options, instruction, allInstructions, required = new Set()) {
  return options.filter((o) => {
    const d = expandShorthand(o.description.toLowerCase());
    // A flag the validator demands always belongs, whatever its help text claims.
    if (required.has(o.flag)) return true;
    if (mentionsInstruction(d, instruction)) return true;
    if (d.includes("required for all instructions")) return true;
    // A section comment scopes the flag to the instructions it names; nothing else may claim it.
    if (o.sections) return o.sections.includes(instruction);
    return !allInstructions.some((i) => i !== instruction && mentionsInstruction(d, i));
  });
}

// "required for <this instruction>" is a requirement; "required if <condition>" is conditional and
// deliberately not treated as required.
function requiredByHelp(description, instruction) {
  const d = expandShorthand(description.toLowerCase());
  const m = d.match(/required for([^.)]*)/);
  return m ? mentionsInstruction(m[1], instruction) : false;
}

const kebab = (camel) => `--${camel.replace(/([A-Z])/g, "-$1").toLowerCase()}`;

// Per-instruction required flags, parsed from the preAction validators. The validators state
// requirements two ways and both must be read, or the catalog silently under-reports:
//   1. literal messages: '❌ <instr> requires: --a, --b'
//   2. literal option arrays: const requiredX = ['remoteChainSelector', 'decimals', ...]
//      (interpolated into a template-literal message, so the flag names never appear as literals)
// Requirements are attributed to the enclosing `options.instruction === '<name>'` branch.
function requiredFlags(idxSource) {
  const req = new Map();
  const add = (instr, flag) => {
    if (!req.has(instr)) req.set(instr, new Set());
    req.get(instr).add(flag);
  };

  // Split the source into per-instruction branches.
  const branchRe = /(?:options\.instruction|instr|i)\s*===\s*'([a-z-]+)'/g;
  const marks = [...idxSource.matchAll(branchRe)].map((m) => ({ instr: m[1], at: m.index }));
  for (let k = 0; k < marks.length; k++) {
    // Markers separated only by `||` share a single body; attribute the body to all of them.
    let end = k;
    while (
      end + 1 < marks.length &&
      /^[\s)|(]*$/.test(idxSource.slice(marks[end].at, marks[end + 1].at).replace(/(?:options\.instruction|instr|i)\s*===\s*'[a-z-]+'/g, ""))
    )
      end++;
    const body = idxSource.slice(marks[k].at, marks[end + 1]?.at ?? idxSource.length);
    const instr = marks[k].instr;
    for (const m of body.matchAll(/([^'`\n]{0,60})requires?:\s*([^'`\n]*)/g)) {
      // "create-mint with Metaplex requires: --name" is conditional, not an unconditional need.
      if (/\b(with|when|if)\b/i.test(m[1])) continue;
      for (const f of m[2].matchAll(/--[\w-]+/g)) add(instr, f[0]);
    }
    for (const m of body.matchAll(/const\s+required\w*\s*=\s*\[([^\]]+)\]/g))
      for (const o of m[1].matchAll(/'([A-Za-z]\w*)'/g)) add(instr, kebab(o[1]));
  }
  return req;
}

// ---------- build the model ----------

const PROGRAM_DIRS = readdirSync(SRC).filter((d) => existsSync(join(SRC, d, "index.ts")));
const meta = existsSync(join(OUT, "_meta.json"))
  ? JSON.parse(readFileSync(join(OUT, "_meta.json"), "utf8"))
  : {};

const programs = [];
for (const dir of PROGRAM_DIRS.sort()) {
  const idx = readFileSync(join(SRC, dir, "index.ts"), "utf8");
  const name = idx.match(/new Command\('([^']+)'\)/)?.[1];
  const alias = idx.match(/\.alias\('([^']+)'\)/)?.[1] ?? null;
  const instrDesc = idx.match(/'(?:Instruction|Utility) to execute \(([^)]+)\)'/)?.[1];
  if (!name || !instrDesc) continue;
  const instructions = instrDesc.split(",").map((s) => s.trim()).filter(Boolean);
  const options = parseOptions(idx);
  const usesExecute = /applyExecuteAuthority/.test(idx);
  programs.push({ dir, name, alias, instructions, options, usesExecute, required: requiredFlags(idx) });
}

const catalog = {
  generatedBy: "script/docs/gen-catalog.mjs",
  note: "Generated from src/commands and src/index.ts. Do not edit by hand; run `pnpm docs:catalog`.",
  cli: `${BIN} <program|alias> --instruction <name> --env <env>|--rpc-url <url> [flags]`,
  globalFlags: parseOptions(readFileSync(join(REPO, "src", "index.ts"), "utf8")).map(
    ({ flag, arg, description }) => ({ flag, arg, description })
  ),
  counts: { programs: programs.length, instructions: programs.reduce((n, p) => n + p.instructions.length, 0) },
  programs: [],
};

for (const p of programs) {
  const entry = { program: p.name, alias: p.alias, source: `src/commands/${p.dir}/index.ts`, instructions: [] };
  for (const ins of p.instructions) {
    const hf = handlerFile(join(SRC, p.dir), ins);
    const m = meta[`${p.name}/${ins}`] ?? {};
    const read_only = classify(p.name, ins, meta);
    entry.instructions.push({
      instruction: ins,
      description: m.description ?? handlerDescription(hf) ?? null,
      read_only,
      execute_capable: !read_only && p.usesExecute,
      handler: hf ? hf.slice(REPO.length + 1) : null,
      flags: flagsFor(p.options, ins, p.instructions, p.required.get(ins) ?? new Set()).map(
        ({ flag, arg, required, description }) => ({
          flag,
          arg,
          required:
            required ||
            (p.required.get(ins)?.has(flag) ?? false) ||
            /required for all instructions/i.test(description) ||
            requiredByHelp(description, ins),
          description,
        })
      ),
      ...(m.when_to_use ? { when_to_use: m.when_to_use } : {}),
      ...(m.preconditions ? { preconditions: m.preconditions } : {}),
      ...(m.failure_modes ? { failure_modes: m.failure_modes } : {}),
      ...(m.example ? { example: m.example } : {}),
    });
  }
  catalog.programs.push(entry);
}

// ---------- render ----------

function pageFor(p, ix) {
  const title = `${p.alias ?? p.program} ${ix.instruction}`;
  const lines = [];
  lines.push("---");
  lines.push(`type: command`);
  lines.push(`program: ${p.program}`);
  lines.push(`alias: ${p.alias ?? ""}`);
  lines.push(`instruction: ${ix.instruction}`);
  lines.push(`read_only: ${ix.read_only}`);
  lines.push(`execute_capable: ${ix.execute_capable}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${title}`);
  lines.push("");
  if (ix.description) lines.push(ix.description, "");
  if (ix.when_to_use) lines.push(`**When to use:** ${ix.when_to_use}`, "");
  if (ix.preconditions) lines.push(`**Preconditions:** ${ix.preconditions}`, "");
  lines.push("## Invocation", "");
  lines.push("```bash");
  lines.push(ix.example ?? `${BIN} ${p.alias ?? p.program} --instruction ${ix.instruction} --env devnet [flags]`);
  lines.push("```", "");
  lines.push("## Flags", "");
  if (ix.flags.length === 0) lines.push("Only the global flags.", "");
  else {
    lines.push("| Flag | Arg | Required | Description |", "| --- | --- | --- | --- |");
    // Backslash first: escaping the pipe adds backslashes of its own, which the other order would
    // then double-escape.
    const cell = (s) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
    for (const f of ix.flags)
      lines.push(`| \`${f.flag}\` | ${f.arg ?? ""} | ${f.required ? "yes" : "optional"} | ${cell(f.description)} |`);
    lines.push("");
  }
  if (ix.failure_modes) lines.push("## Failure modes", "", ix.failure_modes, "");
  lines.push("## Source", "");
  lines.push(`- Router/flags: [\`${p.source}\`](../../../${p.source})`);
  if (ix.handler) lines.push(`- Handler: [\`${ix.handler}\`](../../../${ix.handler})`);
  lines.push("");
  lines.push("_Generated by `script/docs/gen-catalog.mjs` from the commander source; do not edit by hand._");
  lines.push("");
  return lines.join("\n");
}

const files = new Map(); // relative path under OUT -> content
files.set("catalog.json", JSON.stringify(catalog, null, 2) + "\n");

const idx = [];
idx.push("---", "type: index", "---", "", "# Command catalog", "");
idx.push("One page per CLI instruction, generated from `src/commands` (`pnpm docs:catalog`).");
idx.push("Machine-readable: [`catalog.json`](catalog.json). Global flags and invocation shape are in it too.", "");
for (const p of catalog.programs) {
  idx.push(`## ${p.program}${p.alias ? ` (\`${p.alias}\`)` : ""}`, "");
  for (const ix of p.instructions) {
    const tags = [ix.read_only ? "read-only" : "writes", ...(ix.execute_capable ? ["--execute"] : [])].join(", ");
    idx.push(`- [\`${ix.instruction}\`](${p.program}/${ix.instruction}.md) (${tags})${ix.description ? ` - ${ix.description.split(". ")[0].replace(/\.$/, "")}.` : ""}`);
  }
  idx.push("");
}
idx.push("_Generated; edit `docs/commands/_meta.json` for authored context, then regenerate._", "");
files.set("index.md", idx.join("\n"));

for (const p of catalog.programs)
  for (const ix of p.instructions) files.set(join(p.program, `${ix.instruction}.md`), pageFor(p, ix));

// ---------- write or check ----------

let stale = [];
for (const [rel, content] of files) {
  const path = join(OUT, rel);
  // Read straight through instead of testing for existence first: one syscall, and no window
  // between the test and the read for the answer to change.
  let current = null;
  try {
    current = readFileSync(path, "utf8");
  } catch {
    /* not generated yet */
  }
  if (current !== content) stale.push(rel);
  if (!CHECK) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}
// Remove orphaned generated pages (e.g. renamed instruction).
if (!CHECK && existsSync(OUT)) {
  const keep = new Set([...files.keys(), "_meta.json"]);
  const walk = (d, base = "") => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(d, e.name), rel);
      else if (!keep.has(rel)) rmSync(join(d, e.name));
    }
  };
  try { walk(OUT); } catch { /* best effort */ }
}

const total = catalog.counts;
if (CHECK) {
  if (stale.length) {
    console.error(`docs/commands is stale (${stale.length} file(s)): ${stale.slice(0, 10).join(", ")}${stale.length > 10 ? ", ..." : ""}`);
    console.error("Run `pnpm docs:catalog` and commit the result.");
    process.exit(1);
  }
  console.log(`catalog fresh: ${total.programs} programs, ${total.instructions} instructions.`);
} else {
  console.log(`wrote docs/commands: ${total.programs} programs, ${total.instructions} instructions, ${files.size} files.`);
}
