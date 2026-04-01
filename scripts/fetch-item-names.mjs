/**
 * Fetches item names from the Wowhead XML feed for every ID in src/data/itemNames.ts
 * and rewrites that file with the resolved names.
 *
 * Usage: node scripts/fetch-item-names.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = join(__dirname, '../src/data/itemNames.ts');

// ── Parse item IDs from the existing file ────────────────────────────────────

const source = readFileSync(TARGET, 'utf8');
const ids = [...source.matchAll(/^\s+(\d+):/gm)].map(m => Number(m[1]));

console.log(`Found ${ids.length} item IDs to resolve.\n`);

// ── Fetch names from Wowhead XML feed ────────────────────────────────────────

async function fetchName(id) {
  const url = `https://www.wowhead.com/item=${id}&xml`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EbonholdCompendium/1.0 (item name resolver)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for item ${id}`);
  const xml = await res.text();
  const match = xml.match(/<name><!\[CDATA\[([^\]]+)\]\]><\/name>/);
  if (!match) throw new Error(`No <name> found in XML for item ${id}`);
  return match[1];
}

const resolved = {};
const DELAY_MS = 200; // be polite to Wowhead's servers

for (const id of ids) {
  try {
    const name = await fetchName(id);
    resolved[id] = name;
    console.log(`  ${id} → ${name}`);
  } catch (err) {
    resolved[id] = `Item ${id}`; // keep placeholder on failure
    console.warn(`  ${id} → FAILED (${err.message})`);
  }
  await new Promise(r => setTimeout(r, DELAY_MS));
}

// ── Rewrite itemNames.ts ──────────────────────────────────────────────────────

const entries = Object.entries(resolved)
  .map(([id, name]) => `  ${id}: ${JSON.stringify(name)},`)
  .join('\n');

const output =
  `// Item name map covering all ${ids.length} item IDs in the profileset JSON files.\n` +
  `// Names resolved from the Wowhead XML feed. Regenerate with: node scripts/fetch-item-names.mjs\n` +
  `export const itemNames: Record<number, string> = {\n` +
  `${entries}\n` +
  `};\n`;

writeFileSync(TARGET, output, 'utf8');
console.log(`\nWrote ${TARGET}`);
