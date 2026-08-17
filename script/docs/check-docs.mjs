#!/usr/bin/env node
// check-docs.mjs - the docs CI gate. Every relative Markdown link must resolve to a real file, and
// every "#anchor" must resolve to a heading or an explicit <a id> in the target. A renamed heading
// or moved file fails the gate instead of leaving a broken deep link.
//
// Usage: node script/docs/check-docs.mjs   (exit 1 on any problem)

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

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

function docFiles() {
  const files = walk(join(REPO, "docs"));
  for (const root of ["README.md", "AGENTS.md", "CLAUDE.md"]) {
    const p = join(REPO, root);
    if (existsSync(p)) files.push(p);
  }
  return files;
}

// GitHub-style heading slug.
function slug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*~]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s/g, "-");
}

function anchorsOf(src) {
  const anchors = new Set();
  for (const line of src.split("\n")) {
    const h = line.match(/^#{1,6}\s+(.*?)\s*$/);
    if (h) anchors.add(slug(h[1]));
    for (const m of line.matchAll(/<a\s+id=["']([^"']+)["']/g)) anchors.add(m[1]);
    for (const m of line.matchAll(/\{#([\w-]+)\}/g)) anchors.add(m[1]);
  }
  return anchors;
}

// Strip fenced code blocks so example links inside ``` are not checked.
function withoutCodeFences(src) {
  return src.replace(/^```[\s\S]*?^```/gm, "");
}

const problems = [];
const files = docFiles();
const anchorCache = new Map();

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const rel = relative(REPO, file);
  for (const m of withoutCodeFences(src).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    let target = m[1];
    if (/^(https?|mailto):/.test(target)) continue;
    let anchor = null;
    const hash = target.indexOf("#");
    if (hash >= 0) {
      anchor = target.slice(hash + 1);
      target = target.slice(0, hash);
    }
    let targetPath = target === "" ? file : resolve(dirname(file), decodeURIComponent(target));
    if (existsSync(targetPath) && statSync(targetPath).isDirectory()) {
      const idx = join(targetPath, "index.md");
      if (existsSync(idx)) targetPath = idx;
    }
    if (!existsSync(targetPath)) {
      problems.push(`${rel}: broken link -> ${m[1]}`);
      continue;
    }
    if (anchor && targetPath.endsWith(".md")) {
      if (!anchorCache.has(targetPath)) anchorCache.set(targetPath, anchorsOf(readFileSync(targetPath, "utf8")));
      if (!anchorCache.get(targetPath).has(anchor)) problems.push(`${rel}: broken anchor -> ${m[1]}`);
    }
  }
}

if (problems.length) {
  console.error(`docs gate: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(`docs gate: ${files.length} files, all links and anchors resolve.`);
