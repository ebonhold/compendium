import { useState, useEffect } from 'react';
import type { SimcraftFile } from '../types/simcraft';
import { parseProfileset, type ParsedProfileset } from './parseProfileset';
import { StaticItemNameResolver } from './itemNameResolver';
import { loadBaselineDps } from './baseline';
import { itemNames } from '../data/itemNames';
import type { TabConfig } from './tabs';
import type { DatasetConfig } from './datasets';

const cache = new Map<string, ParsedProfileset>();
const resolver = new StaticItemNameResolver(itemNames);

export interface UseProfilesetDataResult {
  data: ParsedProfileset | null;
  loading: boolean;
  error: string | null;
}

export function useProfilesetData(
  config: TabConfig,
  dataset: DatasetConfig,
): UseProfilesetDataResult {
  // Both datasets hold a file per category, so the tab id alone is ambiguous.
  const cacheKey = `${dataset.id}:${config.id}`;

  const [data, setData] = useState<ParsedProfileset | null>(() => cache.get(cacheKey) ?? null);
  const [loading, setLoading] = useState(() => !cache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache.has(cacheKey)) {
      setData(cache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // The baseline is a separate single-actor sim shared by every tab within a
    // dataset; it is fetched once, so this resolves immediately after the first tab.
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/${dataset.dir}/${config.filename}`).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SimcraftFile>;
      }),
      loadBaselineDps(dataset),
    ])
      .then(([json, baselineDps]) => {
        if (cancelled) return;
        const parsed = parseProfileset(json, resolver, config.filterCulled, baselineDps);
        cache.set(cacheKey, parsed);
        setData(parsed);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [cacheKey, config.filename, config.filterCulled, dataset]);

  return { data, loading, error };
}
