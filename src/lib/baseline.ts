import type { BaselineFile } from '../types/simcraft';

/** Single-actor sim in public/data, shared by every tab. */
export const BASELINE_FILENAME = 'baseline.json';

let pending: Promise<number> | null = null;

/**
 * DPS of the baseline actor, fetched once per session and shared across tabs.
 * A failed load clears the cache so the next tab retries rather than inheriting
 * the rejection forever.
 */
export function loadBaselineDps(): Promise<number> {
  pending ??= fetch(`${import.meta.env.BASE_URL}data/${BASELINE_FILENAME}`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status} loading ${BASELINE_FILENAME}`);
      return res.json() as Promise<BaselineFile>;
    })
    .then(json => {
      const mean = json.sim?.players?.[0]?.collected_data?.dps?.mean;
      if (typeof mean !== 'number' || !Number.isFinite(mean) || mean <= 0) {
        throw new Error(`${BASELINE_FILENAME} has no usable player DPS mean`);
      }
      return mean;
    })
    .catch(err => {
      pending = null;
      throw err;
    });

  return pending;
}
