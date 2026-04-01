export interface GearItem {
  item_id: number;
  item_level: number;
}

export interface ProfilesetResult {
  name: string;
  mean: number;
  overrides: { gear?: Record<string, GearItem> };
  culled?: boolean;
  iterations: number;
}

export interface SimcraftFile {
  sim: {
    options: { profileset_metric: string };
    players: [{ collected_data: { dps: { mean: number } } }];
    profilesets: { metric: string; results: ProfilesetResult[] };
  };
}
