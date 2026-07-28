import type { SimcraftFile } from '../types/simcraft';
import type { ItemNameResolver } from './itemNameResolver';

export interface ChartItemRef {
  itemId: number;
  itemLevel: number;
  name: string;
  bonusId?: number[];
  gemId?: number;
  enchantId?: number;
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

export function parseProfileset(
  data: SimcraftFile,
  resolver: ItemNameResolver,
  filterCulled: boolean,
): ParsedProfileset {
  const results = data.sim.profilesets.results;

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
    const items: ChartItemRef[] = [];
    for (const item of Object.values(gear)) {
      const name = resolver.resolve(item.item_id) ?? String(item.item_id);
      items.push({ itemId: item.item_id, itemLevel: item.item_level, name, bonusId: item.bonus_id, gemId: item.gem_id, enchantId: item.enchant_id });
    }
    const label = items.map(i => i.name + ` (${i.itemLevel})` + i.bonusId + i.enchantId).join(' + ');
    return {
      label: label,
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
