import type { SimcraftFile, ProfilesetResult } from '../types/simcraft';
import type { ItemNameResolver } from './itemNameResolver';

export interface ChartItemRef {
  itemId: number;
  itemLevel: number;
  name: string;
  nonDominantIlvl: boolean;
}

export interface ChartEntry {
  label: string;
  items: ChartItemRef[];
  delta: number;
  percentDiff: number;
  absoluteDps: number;
  culled: boolean;
}

export interface ParsedProfileset {
  baselineDps: number;
  entries: ChartEntry[];
}

function computeDominantIlvl(results: ProfilesetResult[]): number {
  const counts = new Map<number, number>();
  for (const result of results) {
    const gear = result.overrides?.gear;
    if (!gear) continue;
    for (const item of Object.values(gear)) {
      counts.set(item.item_level, (counts.get(item.item_level) ?? 0) + 1);
    }
  }
  let dominant = 0;
  let maxCount = 0;
  for (const [ilvl, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      dominant = ilvl;
    }
  }
  return dominant;
}

export function parseProfileset(
  data: SimcraftFile,
  resolver: ItemNameResolver,
  filterCulled: boolean,
): ParsedProfileset {
  const results = data.sim.profilesets.results;
  const dominantIlvl = computeDominantIlvl(results);

  const filtered = results.filter(r => {
    const gear = r.overrides?.gear;
    if (!gear || Object.keys(gear).length === 0) return false; // skip baseline profileset
    if (filterCulled && r.culled === true) return false;
    return true;
  });

  const baselineDps = filtered.length > 0
    ? Math.min(...filtered.map(r => r.mean))
    : data.sim.players[0].collected_data.dps.mean;

  const entries: ChartEntry[] = filtered.map(r => {
    const gear = r.overrides.gear!;
    const seen = new Set<string>();
    const items: ChartItemRef[] = [];
    for (const item of Object.values(gear)) {
      const name = resolver.resolve(item.item_id) ?? String(item.item_id);
      const nonDominantIlvl = item.item_level !== dominantIlvl;
      const key = name + (nonDominantIlvl ? ` (${item.item_level})` : '');
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ itemId: item.item_id, itemLevel: item.item_level, name, nonDominantIlvl });
    }
    const label = items.map(i => i.name + (i.nonDominantIlvl ? ` (${i.itemLevel})` : '')).join(' + ');
    return {
      label,
      items,
      delta: r.mean - baselineDps,
      percentDiff: ((r.mean - baselineDps) / baselineDps) * 100,
      absoluteDps: r.mean,
      culled: r.culled ?? false,
    };
  });

  entries.sort((a, b) => b.delta - a.delta);
  return { baselineDps, entries };
}
