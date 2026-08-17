#!/usr/bin/env node
// check-facts.mjs - canonical-fact consistency gate.
//
// Some facts are deliberately repeated outside their owning page: AGENTS.md restates the PDA seeds
// so an agent does not need a hop for the most-used fact in the repo, and the glossary defines
// them. Repetition is fine; DIVERGENCE is not. This gate pins every copy to one spelling, so
// "authored once" in docs/index.md is enforced rather than aspirational.
//
// Add a fact here when you notice the same value written in two places.
// Usage: node script/docs/check-facts.mjs   (exit 1 on any divergence)

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// The command name workflow steps are expected to use, from package.json `bin` - the same source
// gen-catalog.mjs renders from, so the two can never disagree about what users type.
const BIN = Object.keys(
  JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")).bin ?? {}
)[0];
if (!BIN) throw new Error("package.json has no `bin` entry - workflow commands cannot be checked");

const FACTS = [
  {
    id: "pool-state-seed",
    owner: "docs/concepts/pda-derivation.md",
    // Any bracketed form mentioning the seed must match the canonical spelling exactly.
    find: /\[\s*"ccip_tokenpool_config"[^\]]*\]/g,
    canonical: '["ccip_tokenpool_config", mint]',
  },
  {
    id: "pool-signer-seed",
    owner: "docs/concepts/pda-derivation.md",
    find: /\[\s*"ccip_tokenpool_signer"[^\]]*\]/g,
    canonical: '["ccip_tokenpool_signer", mint]',
  },
  {
    id: "chain-config-seed",
    owner: "docs/concepts/pda-derivation.md",
    find: /\[\s*"ccip_tokenpool_chainconfig"[^\]]*\]/g,
    canonical: '["ccip_tokenpool_chainconfig", u64LE(selector), mint]',
  },
  {
    id: "anchor-discriminator",
    owner: "docs/concepts/encoding.md",
    find: /sha256\("global:[^)]*\)\[0\.\.8\]/g,
    canonical: 'sha256("global:<snake_name>")[0..8]',
  },
  {
    id: "writable-indexes",
    owner: "docs/concepts/pda-derivation.md",
    // Spacing is free (the CLI form has none, prose has spaces) but the values and order are not.
    find: /writable[ -]?indexes[^[\n]{0,40}\[\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\]/gi,
    normalize: (s) => s.replace(/.*\[/s, "[").replace(/\s+/g, ""),
    canonical: "[3,4,7]",
  },
];

// Every `command:` in a workflow's steps: frontmatter must name a real instruction and only flags
// that instruction accepts. Without this the workflows are unverified prose: removing a flag from
// the CLI breaks three pages silently.
function checkWorkflowCommands(problems) {
  const catalogPath = join(REPO, "docs", "commands", "catalog.json");
  const wfDir = join(REPO, "docs", "workflows");
  if (!existsSync(catalogPath) || !existsSync(wfDir)) return 0;
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const globals = new Set(catalog.globalFlags.map((f) => f.flag));
  const byInstruction = new Map();
  for (const p of catalog.programs)
    for (const ix of p.instructions) {
      for (const key of [`${p.program} ${ix.instruction}`, `${p.alias} ${ix.instruction}`])
        byInstruction.set(key, new Set(ix.flags.map((f) => f.flag)));
    }

  let checked = 0;
  for (const file of readdirSync(wfDir).filter((f) => f.endsWith(".md"))) {
    const src = readFileSync(join(wfDir, file), "utf8");
    const fm = src.split("\n---")[0];
    for (const m of fm.matchAll(/command:\s*"((?:[^"\\]|\\.)*)"/g)) {
      const cmd = m[1];
      if (!cmd.includes(BIN)) continue; // external steps are prose by design
      // BIN comes from package.json, so escape it: a `.` in a package name would silently widen the
      // match and a `+` or `(` would throw and take the whole gate down.
      const binRe = BIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const parsed = cmd.match(new RegExp(`${binRe}\\s+([\\w-]+)[\\s\\S]*?--instruction\\s+([\\w-]+)`));
      if (!parsed) continue;
      const key = `${parsed[1]} ${parsed[2]}`;
      const allowed = byInstruction.get(key);
      checked++;
      if (!allowed) {
        problems.push(`docs/workflows/${file}: no such instruction in the catalog -> ${key}`);
        continue;
      }
      for (const f of cmd.matchAll(/(?<![\w-])(--[\w-]+)/g)) {
        const flag = f[1];
        if (flag === "--instruction" || globals.has(flag) || allowed.has(flag)) continue;
        problems.push(`docs/workflows/${file}: ${key} does not accept ${flag}`);
      }
    }
  }
  return checked;
}

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

const files = [
  ...walk(join(REPO, "docs")),
  ...["README.md", "AGENTS.md", "CLAUDE.md"].map((f) => join(REPO, f)).filter(existsSync),
].filter((f) => statSync(f).isFile());

const problems = [];
const counts = new Map();

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const rel = relative(REPO, file);
  for (const fact of FACTS) {
    for (const m of src.matchAll(fact.find)) {
      const seen = fact.normalize ? fact.normalize(m[0]) : m[0];
      counts.set(fact.id, (counts.get(fact.id) ?? 0) + 1);
      if (seen !== fact.canonical) {
        problems.push(
          `${rel}: ${fact.id} written as ${JSON.stringify(seen)}, canonical is ` +
            `${JSON.stringify(fact.canonical)} (owner: ${fact.owner})`
        );
      }
    }
  }
}

// A fact that no longer appears anywhere is a stale rule, not a passing check.
for (const fact of FACTS) {
  if (!counts.get(fact.id)) problems.push(`${fact.id}: no occurrences found - is the rule stale?`);
}

const commandsChecked = checkWorkflowCommands(problems);

if (problems.length) {
  console.error(`facts gate: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(
  `facts gate: ${FACTS.length} canonical facts consistent across ` +
    `${[...counts.values()].reduce((a, b) => a + b, 0)} occurrences; ` +
    `${commandsChecked} workflow commands match the catalog.`
);
