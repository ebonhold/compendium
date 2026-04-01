import { useProfilesetData } from '../lib/useProfilesetData';
import type { TabConfig } from '../lib/tabs';
import { DpsBarChart } from './DpsBarChart';
import styles from '../styles/ChartPanel.module.css';

interface Props {
  config: TabConfig;
}

export function ChartPanel({ config }: Props) {
  const { data, loading, error } = useProfilesetData(config);

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
        Baseline: <strong>{data.baselineDps.toFixed(0)} DPS</strong>
        &ensp;·&ensp;{data.entries.length} entries
      </p>
      <DpsBarChart entries={data.entries} />
    </div>
  );
}
