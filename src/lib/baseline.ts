import type { BaselineFile } from '../types/simcraft';
import type { DatasetConfig } from './datasets';

/** Single-actor sim living alongside each dataset's profileset files. */
export const BASELINE_FILENAME = 'baseline.json';

const pending = new Map<string, Promise<number>>();

/**
 * DPS of a dataset's baseline actor, fetched once per session and shared across
 * that dataset's tabs. Cached per dataset — each hero talent tree is scored
 * against its own best known profile, so one shared promise would score both
 * against whichever loaded first.
 *
 * A failed load drops the entry so the next tab retries rather than inheriting
 * the rejection forever.
 */
export function loadBaselineDps(dataset: DatasetConfig): Promise<number> {
  const cached = pending.get(dataset.id);
  if (cached) return cached;

  const request = fetch(`${import.meta.env.BASE_URL}data/${dataset.dir}/${BASELINE_FILENAME}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} loading ${dataset.dir}/${BASELINE_FILENAME}`);
      }
      return res.json() as Promise<BaselineFile>;
    })
    .then(json => {
      const mean = json.sim?.players?.[0]?.collected_data?.dps?.mean;
      if (typeof mean !== 'number' || !Number.isFinite(mean) || mean <= 0) {
        throw new Error(`${dataset.dir}/${BASELINE_FILENAME} has no usable player DPS mean`);
      }
      return mean;
    })
    .catch(err => {
      pending.delete(dataset.id);
      throw err;
    });

  pending.set(dataset.id, request);
  return request;
}
