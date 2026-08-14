import type { DatasetConfig } from '../lib/datasets';
import styles from '../styles/DatasetToggle.module.css';

interface Props {
  datasets: DatasetConfig[];
  activeDataset: string;
  onDatasetChange: (datasetId: string) => void;
}

/**
 * Switches the whole page between hero talent datasets. Deliberately a button
 * group rather than a tablist — the category strip below already owns the tab
 * metaphor, and the two controls should not read as the same mechanism.
 */
export function DatasetToggle({ datasets, activeDataset, onDatasetChange }: Props) {
  return (
    <div className={styles.toggle} role="group" aria-label="Data set">
      {datasets.map(dataset => {
        const selected = dataset.id === activeDataset;
        return (
          <button
            key={dataset.id}
            type="button"
            aria-pressed={selected}
            className={selected ? `${styles.option} ${styles.selected}` : styles.option}
            onClick={() => onDatasetChange(dataset.id)}
          >
            {dataset.label}
          </button>
        );
      })}
    </div>
  );
}
