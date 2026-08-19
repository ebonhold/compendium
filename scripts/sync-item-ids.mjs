/**
 * Scans every profileset JSON in public/data for gear item IDs and adds any that
 * are missing from src/data/itemNames.ts as `Item <id>` placeholders.
 *
 * Existing names are never touched — resolving the placeholders is the job of
 * scripts/fetch-item-names.mjs, which is meant to run straight after this.
 *
 * Usage: node scripts/sync-item-ids.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = join(__dirname, '../src/data/itemNames.ts');
const DATA_DIR = join(__dirname, '../public/data');

// ── Read the current map ─────────────────────────────────────────────────────

const source = readFileSync(TARGET, 'utf8');
const entries = new Map(
  [...source.matchAll(/^\s+(\d+):\s*("(?:[^"\\]|\\.)*")\s*,\s*$/gm)]
    .map(m => [Number(m[1]), JSON.parse(m[2])]),
);

console.log(`src/data/itemNames.ts currently holds ${entries.size} item IDs.`);

// ── Collect every gear item ID in the profileset files ───────────────────────

// public/data holds one subfolder per dataset (rider/, db/). Descend a level,
// while still tolerating JSON sitting directly in public/data.
const files = readdirSync(DATA_DIR, { withFileTypes: true })
  .flatMap(entry => {
    if (entry.isDirectory()) {
      return readdirSync(join(DATA_DIR, entry.name))
        .filter(f => f.endsWith('.json'))
        .map(f => join(entry.name, f));
    }
    return entry.name.endsWith('.json') ? [entry.name] : [];
  })
  .sort();

const seen = new Set();

for (const file of files) {
  const data = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
  const results = data?.sim?.profilesets?.results ?? [];
  const before = seen.size;

  for (const result of results) {
    for (const item of Object.values(result.overrides?.gear ?? {})) {
      if (typeof item?.item_id === 'number') seen.add(item.item_id);
      // Catalyst-converted pieces name a second item — the one supplying their
      // base stats — which the chart labels too. `0` means "not converted".
      if (item?.redirected_base_stats_id) seen.add(item.redirected_base_stats_id);
    }
  }

  console.log(`  ${file}: ${results.length} profilesets, ${seen.size - before} new IDs`);
}

// ── Add the missing ones as placeholders ─────────────────────────────────────

const missing = [...seen].filter(id => !entries.has(id)).sort((a, b) => a - b);
const stale = [...entries.keys()].filter(id => !seen.has(id));

if (stale.length > 0) {
  console.log(`\n${stale.length} mapped ID(s) no longer appear in public/data (left in place): ${stale.join(', ')}`);
}

if (missing.length === 0) {
  console.log('\nNo new item IDs. Nothing to write.');
  process.exit(0);
}

for (const id of missing) entries.set(id, ``);

const serialized = [...entries.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([id, name]) => `  ${id}: ${JSON.stringify(name)},`)
  .join('\n');

writeFileSync(
  TARGET,
  `// Item name map covering all ${entries.size} item IDs in the profileset JSON files.\n` +
    `// Names resolved from the Wowhead XML feed. Regenerate with: node scripts/fetch-item-names.mjs\n` +
    `export const itemNames: Record<number, string> = {\n` +
    `${serialized}\n` +
    `};\n`,
  'utf8',
);

console.log(`\nAdded ${missing.length} placeholder(s): ${missing.join(', ')}`);
console.log(`Wrote ${TARGET}`);
console.log('\nNow run: yarn fetch-item-names');
