#!/usr/bin/env node
/**
 * theme-check — verify every colour theme defines the token set the contract
 * lists, for both light (`:root`) and dark (`.dark`).
 *
 *   node scripts/theme-check.mjs
 *
 * Exits non-zero if a theme is missing a required token in either block.
 * Primitive ramp tokens (`--pw-*`, `--vs-*`, …) are a theme's own business and
 * are not checked. Runs before `npm run build` via the "prebuild" script.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const themesDir = join(root, 'src/styles/themes');

/** `--token` names mentioned anywhere in the contract file. */
function contractTokens() {
  const src = readFileSync(join(themesDir, '_contract.css'), 'utf8');
  return new Set([...src.matchAll(/--[a-z0-9-]+/gi)].map((m) => m[0]));
}

/** `--token`s assigned inside a given selector's block (comments stripped). */
function assignedIn(src, selector) {
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const body = clean.match(re)?.[1] ?? '';
  return new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
}

const required = contractTokens();
const files = readdirSync(themesDir)
  .filter((f) => f.endsWith('.css') && !f.startsWith('_'))
  .sort();

let failed = false;
for (const f of files) {
  const src = readFileSync(join(themesDir, f), 'utf8');
  const blocks = { 'light (:root)': assignedIn(src, ':root'), 'dark (.dark)': assignedIn(src, '\\.dark') };
  const problems = [];
  for (const [label, defined] of Object.entries(blocks)) {
    const missing = [...required].filter((t) => !defined.has(t));
    if (missing.length) problems.push([label, missing]);
  }
  if (problems.length) {
    failed = true;
    console.error(`✗ ${f}`);
    for (const [label, missing] of problems) {
      console.error(`    ${label} missing ${missing.length}: ${missing.join(', ')}`);
    }
  } else {
    console.log(`✓ ${f}`);
  }
}

if (failed) {
  console.error('\ntheme-check failed — see src/styles/themes/_contract.css for the token list.');
  process.exit(1);
}
console.log('\nAll themes satisfy the contract.');
