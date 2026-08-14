# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ebonhold Compendium — a static single-page site that reads SimulationCraft
profileset JSON files and renders each profileset's DPS delta as a horizontal
bar chart, for a Frost Death Knight. No backend; deploys as static files to
GitHub Pages. Full functional spec (data contract, delta math, chart layout
rules) lives in [requirements.md](requirements.md) — read it before changing
parsing or chart behavior.

## Commands

```
yarn install       # install deps (yarn.lock is the source of truth; CI uses --frozen-lockfile)
yarn dev            # Vite dev server
yarn build           # tsc -b (typecheck + project refs) && vite build -> dist/
yarn preview          # serve the production build locally
yarn fetch-item-names  # regenerate src/data/itemNames.ts from Wowhead
```

There is no lint script and no test suite (explicitly out of scope per
requirements.md). `yarn build` is the closest thing to a CI gate — it runs
the TypeScript compiler in `-b` (project references) mode, so type errors
fail the build.

## Architecture

**Data flow:** `public/data/<dataset>/*.json` (raw SimulationCraft output, one
file per gear category) → fetched lazily per dataset+tab by
[useProfilesetData](src/lib/useProfilesetData.ts) → parsed/filtered/sorted by
[parseProfileset](src/lib/parseProfileset.ts) → rendered by
[DpsBarChart](src/components/DpsBarChart.tsx) (Recharts).

- **The data has two dimensions**: dataset (hero talent tree) × category tab.
  [datasets.ts](src/lib/datasets.ts) is the single array (`DATASETS`) mapping
  dataset id → label → `public/data` subfolder; today that's `rider/`
  (Riders of the Apocalypse) and `db/` (Deathbringer). Each subfolder holds a
  full set of category files **plus its own `baseline.json`**, so each tree is
  scored against its own best known profile.
- **Tabs are config-driven**, not per-tab components. [tabs.ts](src/lib/tabs.ts)
  is the single array (`TABS`) mapping tab id → JSON filename → whether culled
  entries should be filtered out for that category. Adding/removing a category
  is a one-line edit there plus dropping that JSON file in *every* dataset
  folder.
- **The dataset toggle is not a tab**: [DatasetToggle](src/components/DatasetToggle.tsx)
  is a `role="group"` of `aria-pressed` buttons, styled as a rounded segmented
  control, deliberately distinct from `TabBar`'s red-underlined `role="tablist"`.
  Keep those two visual languages separate.
- **Fetch-once, cache-forever per session**: `useProfilesetData` keeps a
  module-level `Map` cache keyed `datasetId:tabId`, `baseline.ts` caches one
  promise per dataset id, and `App.tsx` tracks `visitedPanels` in a ref on the
  same composite key so an already-rendered `ChartPanel` stays mounted (hidden
  via CSS) instead of being torn down — switching datasets or tabs never
  refetches or reparses.
- **Parsing/business logic is intentionally decoupled from React** — all of
  the domain logic (baseline detection, delta/percent math, item-label
  construction, dominant-ilvl detection) lives in the pure function
  `parseProfileset`, not in components or hooks. Change chart *behavior* there;
  change chart *rendering* in `DpsBarChart.tsx`.
- **Item name resolution is behind an interface** (`ItemNameResolver` in
  [itemNameResolver.ts](src/lib/itemNameResolver.ts)) specifically so the
  bundled static map (`StaticItemNameResolver` + [itemNames.ts](src/data/itemNames.ts))
  could later be swapped for a live API without touching `parseProfileset` or
  any component. `itemNames.ts` is generated data — don't hand-edit it, use
  `yarn fetch-item-names` (scrapes the Wowhead XML feed; adds new IDs found in
  the file as `Item <id>` placeholders that need names resolved via a refetch).
- **Baseline/score semantics** (see requirements.md for full detail):
  `public/data/<dataset>/baseline.json` is that dataset's *best known profile* —
  a single-actor sim with no `profilesets` block, loaded once per session by
  [baseline.ts](src/lib/baseline.ts) and shared by every tab in that dataset. Each bar is scored
  as `percentOfBaseline = mean / baselineDps * 100`, so the strongest entry sits
  near 100% and bars are comparable across categories; anything over 100% beats
  the baseline and means `baseline.json` is stale. Within each profileset file
  the baseline profileset (no `overrides.gear`) is still excluded from the
  chart. `baseline.json` must be simmed with the same fight style, length,
  talents, and target count as the profileset files or the scores are
  meaningless. The X-axis deliberately does not start at 0 — see `axisFloor` in
  `DpsBarChart.tsx`.
- **Styling** is CSS Modules, one stylesheet per component (`src/styles/*.module.css`).

## Deployment

GitHub Actions ([deploy.yml](.github/workflows/deploy.yml)) builds with Yarn
and deploys `dist/` to GitHub Pages on every push to `main`. Vite's `base` is
hardcoded to `/compendium/` in [vite.config.ts](vite.config.ts) to match the
GitHub Pages path — keep those in sync if the repo is ever renamed/forked.
