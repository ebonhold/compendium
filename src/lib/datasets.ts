export interface DatasetConfig {
  id: string;
  label: string;
  /** Subfolder under public/data holding this dataset's profileset + baseline files. */
  dir: string;
}

export const DATASETS: DatasetConfig[] = [
  { id: 'rider', label: 'Riders of the Apocalypse', dir: 'rider' },
  { id: 'db',    label: 'Deathbringer',             dir: 'db'    },
];

export const DEFAULT_DATASET = DATASETS[0];
