import type { SimcraftFile } from '../types/simcraft';
import type { ItemNameResolver } from './itemNameResolver';

export interface ChartItemRef {
  itemId: number;
  itemLevel: number;
  name: string;
  bonusId?: number[];
  gemId?: number;
  enchantId?: number;
  /** Set only for catalyst-converted pieces: the item supplying the base stats. */
  baseItemId?: number;
  baseName?: string;
}

export interface ChartEntry {
  /**
   * The SimulationCraft profileset name — unique within a file, so it is what
   * identifies a row. Gear contents cannot serve as an identity: tier-set
   * profilesets differ only by each slot's `redirected_base_stats_id`, and some
   * trinket profilesets share byte-identical gear entirely.
   */
  id: string;
  label: string;
  items: ChartItemRef[];
  delta: number;
  /** How close this profileset gets to the baseline profile, as a percentage of it. */
  percentOfBaseline: number;
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
  /** DPS of the best-known-profile sim; every entry is scored as a percentage of it. */
  baselineDps: number,
): ParsedProfileset {
  const results = data.sim.profilesets.results;

  const filtered = results.filter(r => {
    const gear = r.overrides?.gear;
    if (!gear || Object.keys(gear).length === 0) return false; // skip baseline profileset
    if (filterCulled && r.culled === true) return false;
    return true;
  });

  const entries: ChartEntry[] = filtered.map(r => {
    const gear = r.overrides.gear!;
    const items: ChartItemRef[] = [];
    for (const item of Object.values(gear)) {
      const name = resolver.resolve(item.item_id) ?? String(item.item_id);
      // `0` is SimulationCraft's "not catalyst-converted" sentinel, so coerce it
      // away rather than testing for the key's presence — it is always present.
      const baseItemId = item.redirected_base_stats_id || undefined;
      const baseName = baseItemId ? resolver.resolve(baseItemId) ?? String(baseItemId) : undefined;
      items.push({ itemId: item.item_id, itemLevel: item.item_level, name, bonusId: item.bonus_id, gemId: item.gem_id, enchantId: item.enchant_id, baseItemId, baseName });
    }
    const label = items.map(i => `${i.name} (${i.itemLevel})`).join(' + ');
    return {
      id: r.name,
      label,
      items,
      delta: r.mean - baselineDps,
      percentOfBaseline: baselineDps > 0 ? (r.mean / baselineDps) * 100 : 0,
      absoluteDps: r.mean,
      culled: r.culled ?? false,
    };
  });

  entries.sort((a, b) => b.percentOfBaseline - a.percentOfBaseline);
  return { baselineDps, entries };
}
