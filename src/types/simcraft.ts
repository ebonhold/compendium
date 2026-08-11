export interface GearItem {
  item_id: number;
  item_level: number;
  bonus_id?: number[];
  gem_id?: number;
  enchant_id?: number;
}

export interface ProfilesetResult {
  name: string;
  mean: number;
  overrides: { gear?: Record<string, GearItem> };
  culled?: boolean;
  iterations: number;
}

/**
 * A single-actor sim with no profilesets — public/data/baseline.json. Its
 * player DPS is the point of comparison every profileset delta is measured
 * against.
 */
export interface BaselineFile {
  sim: {
    players: [{ collected_data: { dps: { mean: number } } }];
  };
}

export interface SimcraftFile {
  sim: {
    options: { profileset_metric: string };
    players: [{ collected_data: { dps: { mean: number } } }];
    profilesets: { metric: string; results: ProfilesetResult[] };
  };
}
