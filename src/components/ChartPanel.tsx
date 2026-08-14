import { useProfilesetData } from '../lib/useProfilesetData';
import type { TabConfig } from '../lib/tabs';
import type { DatasetConfig } from '../lib/datasets';
import { DpsBarChart } from './DpsBarChart';
import styles from '../styles/ChartPanel.module.css';

interface Props {
  config: TabConfig;
  dataset: DatasetConfig;
}

export function ChartPanel({ config, dataset }: Props) {
  const { data, loading, error } = useProfilesetData(config, dataset);

  if (loading) {
    return <div className={styles.status}>Loading {config.label}…</div>;
  }

  if (error) {
    return <div className={styles.statusError}>Error loading {config.label}: {error}</div>;
  }

  if (!data || data.entries.length === 0) {
    return <div className={styles.status}>No data for {config.label}.</div>;
  }

  return (
    <div className={styles.panel}>
      <p className={styles.meta}>
        {data.entries.length} entries
      </p>
      <DpsBarChart entries={data.entries} />
    </div>
  );
}
