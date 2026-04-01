# Ebonhold Compendium — Requirements

## Overview

A static single-page web application that reads SimulationCraft profileset JSON
files and renders the DPS delta for each result as a horizontal bar chart.
Deploys to GitHub Pages via GitHub Actions with no backend or server-side
rendering.

## Tech Stack

| Concern    | Choice                                      |
|------------|---------------------------------------------|
| Bundler    | Vite                                        |
| UI         | React 18 + TypeScript                       |
| Charting   | Recharts                                    |
| Styling    | CSS Modules                                 |
| Deployment | GitHub Pages via GitHub Actions             |

Recharts is chosen for its native React/SVG rendering, first-class TypeScript
types, and built-in support for `layout="vertical"` bar charts with reference
lines.

## Data Sources

Six JSON files served as static assets from `public/data/`:

| File               | Tab Label      | Filter Rule             |
|--------------------|----------------|-------------------------|
| embellished_1.json | Embellishments | Non-culled entries only |
| jewelry_1.json     | Jewelry        | All entries             |
| other_1.json       | Other          | All entries             |
| tier_set_1.json    | Tier Set       | All entries             |
| trinkets_1.json    | Trinkets       | All entries             |
| weapons_1.json     | Weapons        | All entries             |

Files are fetched lazily when their tab is first activated and cached for the
session.

## JSON Data Contract

```
{
  sim: {
    options: { profileset_metric: "dps" },
    players: [{ collected_data: { dps: { mean: number } } }],
    profilesets: {
      metric: string,
      results: Array<{
        name: string,            // numeric string index; NOT the item name
        mean: number,
        overrides: {
          gear?: {
            [slot: string]: { item_id: number, item_level: number }
          }
        },
        culled?: boolean,        // absent = not culled
        iterations: number
      }>
    }
  }
}
```

## Baseline Identification

The baseline DPS for each chart is the `mean` of the entry with the lowest DPS
among all displayed entries (after filtering). All deltas are relative to this
minimum entry, so the lowest entry always has delta = 0.

A result is the "baseline profileset" when `overrides.gear` is absent or empty.
The baseline profileset is excluded from the chart.

## Delta Calculation

```
delta = result.mean - baseline_mean
```

## Culled Entry Handling

- `embellished_1.json`: display **non-culled entries only** (`culled` absent or
  `false`) — approximately 19 entries.
- All other files: display **all entries** regardless of `culled` value,
  excluding only the baseline profileset itself.

## Chart Specification

- Type: horizontal bar chart (`layout="vertical"` in Recharts)
- X-axis: Percent difference relative to the lowest-DPS entry (e.g. `+1.23%`). The lowest entry sits at 0%.
- Each bar displays a label showing its absolute DPS value (e.g. `312,450`).
- Y-axis: resolved item name(s), or `item_id` as fallback
- Bars sorted by delta **descending** (highest dps at top)
- No error bars
- Dynamic height: `Math.max(300, entryCount * 28)` px; wrapper scrollable

## Y-Axis Label Strategy

For each result, labels are constructed by:

1. Resolving each overridden slot's `item_id` to a name via `ItemNameResolver`.
2. Joining all resolved names with ` + ` (e.g. `Writhing Armor Banding + Soulstring`).
3. Appending ` (ilvl)` when an item's level deviates from the file's dominant
   item level (e.g. `Ancient Draenei Trinket (220)`).
4. Falling back to the raw `item_id` string for any unresolved item.

## Item Name Resolution

```typescript
interface ItemNameResolver {
  resolve(itemId: number): string | undefined;
}
```

The default implementation, `StaticItemNameResolver`, wraps a bundled
`src/data/itemNames.ts` file — a plain `Record<number, string>` map covering
all item IDs present in the six JSON files.

The interface is designed so an API-backed implementation (e.g. Blizzard API or
Wowhead) can be substituted without changing any consuming components.

## UI Layout

- Horizontal tab bar with one tab per file/category
- Active tab fetches JSON on first activation; result cached for the session
- Loading indicator while fetch is in progress

## Deployment

- GitHub Actions workflow triggers on push to `main`
- Build: `npm ci && npm run build` → `dist/`
- Deploy: `dist/` → GitHub Pages
- Vite `base`: `/compendium/` (matches repo name `github.com/ebonhold/compendium`)
- Live URL: `https://ebonhold.github.io/compendium/`

## Out of Scope (v1)

- No backend, API proxy, or server-side rendering
- No authentication
- No user-editable data
- No dark/light theme toggle
- No automated test suite
