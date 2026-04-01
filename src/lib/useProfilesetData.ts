import { useState, useEffect } from 'react';
import type { SimcraftFile } from '../types/simcraft';
import { parseProfileset, type ParsedProfileset } from './parseProfileset';
import { StaticItemNameResolver } from './itemNameResolver';
import { itemNames } from '../data/itemNames';
import type { TabConfig } from './tabs';

const cache = new Map<string, ParsedProfileset>();
const resolver = new StaticItemNameResolver(itemNames);

export interface UseProfilesetDataResult {
  data: ParsedProfileset | null;
  loading: boolean;
  error: string | null;
}

export function useProfilesetData(config: TabConfig): UseProfilesetDataResult {
  const [data, setData] = useState<ParsedProfileset | null>(() => cache.get(config.id) ?? null);
  const [loading, setLoading] = useState(() => !cache.has(config.id));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache.has(config.id)) {
      setData(cache.get(config.id)!);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${import.meta.env.BASE_URL}data/${config.filename}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SimcraftFile>;
      })
      .then(json => {
        if (cancelled) return;
        const parsed = parseProfileset(json, resolver, config.filterCulled);
        cache.set(config.id, parsed);
        setData(parsed);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [config.id, config.filename, config.filterCulled]);

  return { data, loading, error };
}
