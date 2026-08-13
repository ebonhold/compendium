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

`public/data/baseline.json` is the **best known profile** — a dedicated
single-actor sim of the strongest gear setup found so far. Its player DPS is the
target every profileset is scored against:

```
baseline_mean = baseline.sim.players[0].collected_data.dps.mean
```

That file contains no `profilesets` block. It is fetched once per session and
shared by every tab, so the same target applies across all charts and bars are
directly comparable between categories.

For the score to be meaningful, `baseline.json` must be simmed with the same
fight style, fight length, talents, and target count as the profileset files —
otherwise it measures the difference between two sim configurations rather than
the effect of the gear.

Within a profileset file, a result is the "baseline profileset" when
`overrides.gear` is absent or empty. It is still excluded from the chart.

## Score Calculation

Entries are ranked by how close they get to the baseline profile, expressed as a
percentage of it:

```
percent_of_baseline = (result.mean / baseline_mean) * 100
```

The best entry sits at or near 100%. A value above 100% means that profileset
beats the best known profile, and is a signal that `baseline.json` is stale.

## Culled Entry Handling

- `embellished_1.json`: display **non-culled entries only** (`culled` absent or
  `false`) — approximately 19 entries.
- All other files: display **all entries** regardless of `culled` value,
  excluding only the baseline profileset itself.

## Chart Specification

- Type: horizontal bar chart (`layout="vertical"` in Recharts)
- X-axis: percent of the baseline profile (e.g. `99.42%`). The axis runs from a
  round number just below the weakest entry to `max(100%, best entry)` — it does
  **not** start at 0, which would make every bar look nearly full. A dashed
  reference line marks 100%.
- Each bar displays a label showing its percent of baseline (e.g. `99.42%`).
- Bar fill is neutral for entries below the baseline (the normal case) and green
  for any entry at or above 100%.
- Y-axis: resolved item name(s), or `item_id` as fallback
- Bars sorted by percent of baseline **descending** (highest dps at top)
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
