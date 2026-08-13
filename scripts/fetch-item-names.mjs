/**
 * Fetches item names from the Wowhead XML feed for every ID in src/data/itemNames.ts
 * and rewrites that file with the resolved names.
 *
 * Usage: node scripts/fetch-item-names.mjs [--missing]
 *
 *   --missing   only resolve `Item <id>` placeholders, leaving already-named
 *               entries alone. Far fewer requests, which matters because
 *               Wowhead starts returning 403 after a few hundred in a row.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = join(__dirname, '../src/data/itemNames.ts');

// ── Parse item IDs from the existing file ────────────────────────────────────

const source = readFileSync(TARGET, 'utf8');
const existing = new Map(
  [...source.matchAll(/^\s+(\d+):\s*("(?:[^"\\]|\\.)*")\s*,\s*$/gm)]
    .map(m => [Number(m[1]), JSON.parse(m[2])]),
);
const missingOnly = process.argv.includes('--missing');
const isPlaceholder = (id, name) => name === ``;
const ids = missingOnly
  ? [...existing].filter(([id, name]) => isPlaceholder(id, name)).map(([id]) => id)
  : [...existing.keys()];

console.log(
  `Found ${existing.size} item IDs; resolving ${ids.length}` +
    `${missingOnly ? ' unresolved placeholder(s)' : ''}.\n`,
);

// ── Fetch names from Wowhead XML feed ────────────────────────────────────────

async function fetchName(id) {
  const url = `https://www.wowhead.com/item=${id}&xml`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'EbonholdCompendium/1.0 (item name resolver)',
      // Wowhead serves a stale cached "Item not found!" for the gzipped variant
      // of some item URLs, and Node's fetch asks for gzip by default.
      'Accept-Encoding': 'identity',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for item ${id}`);
  const xml = await res.text();
  const match = xml.match(/<name><!\[CDATA\[([^\]]+)\]\]><\/name>/);
  if (!match) throw new Error(`No <name> found in XML for item ${id}`);
  return match[1];
}

const resolved = new Map(existing); // entries we don't refetch keep their name
const DELAY_MS = 200; // be polite to Wowhead's servers
const RETRY_BACKOFF_MS = [2000, 8000, 20000]; // Wowhead throttles with a 403
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;

for (const id of ids) {
  try {
    const name = await fetchNameWithRetry(id);
    resolved.set(id, name);
    console.log(`  ${id} → ${name}`);
  } catch (err) {
    // Keep whatever the file already had rather than clobbering a good name
    // with a placeholder because of a transient Wowhead failure.
    const kept = existing.get(id) ?? ``;
    resolved.set(id, kept);
    failures++;
    console.warn(`  ${id} → FAILED (${err.message}) — kept ${JSON.stringify(kept)}`);
  }
  await sleep(DELAY_MS);
}

async function fetchNameWithRetry(id) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchName(id);
    } catch (err) {
      const throttled = /HTTP (403|429)/.test(err.message);
      if (!throttled || attempt >= RETRY_BACKOFF_MS.length) throw err;
      const wait = RETRY_BACKOFF_MS[attempt];
      console.warn(`  ${id} → throttled, retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}

// ── Rewrite itemNames.ts ──────────────────────────────────────────────────────

const entries = [...resolved.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([id, name]) => `  ${id}: ${JSON.stringify(name)},`)
  .join('\n');

const output =
  `// Item name map covering all ${resolved.size} item IDs in the profileset JSON files.\n` +
  `// Names resolved from the Wowhead XML feed. Regenerate with: node scripts/fetch-item-names.mjs\n` +
  `export const itemNames: Record<number, string> = {\n` +
  `${entries}\n` +
  `};\n`;

writeFileSync(TARGET, output, 'utf8');
console.log(`\nWrote ${TARGET}`);

const unresolved = [...resolved].filter(([id, name]) => isPlaceholder(id, name)).map(([id]) => id);
if (failures > 0) console.log(`${failures} ID(s) failed this run.`);
if (unresolved.length > 0) console.log(`Still unresolved: ${unresolved.join(', ')}`);
