import { useState, useRef } from 'react';
import { TabBar } from './TabBar';
import { DatasetToggle } from './DatasetToggle';
import { ChartPanel } from './ChartPanel';
import { TABS } from '../lib/tabs';
import { DATASETS, DEFAULT_DATASET } from '../lib/datasets';
import styles from '../styles/App.module.css';

/** Panels are kept mounted per dataset+tab pair, so both dimensions key the set. */
const panelKey = (datasetId: string, tabId: string) => `${datasetId}:${tabId}`;

export function App() {
  const [activeDataset, setActiveDataset] = useState(DEFAULT_DATASET.id);
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const visitedPanels = useRef<Set<string>>(
    new Set([panelKey(DEFAULT_DATASET.id, TABS[0].id)]),
  );

  const handleTabChange = (tabId: string) => {
    visitedPanels.current.add(panelKey(activeDataset, tabId));
    setActiveTab(tabId);
  };

  // Switching datasets keeps the current category, so the user stays on the
  // comparison they were looking at.
  const handleDatasetChange = (datasetId: string) => {
    visitedPanels.current.add(panelKey(datasetId, activeTab));
    setActiveDataset(datasetId);
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Ebonhold Compendium</h1>
        <p>Frost Death Knight</p>
      </header>
      <DatasetToggle
        datasets={DATASETS}
        activeDataset={activeDataset}
        onDatasetChange={handleDatasetChange}
      />
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
      <main className={styles.main}>
        {DATASETS.flatMap(dataset =>
          TABS.map(tab => {
            const key = panelKey(dataset.id, tab.id);
            if (!visitedPanels.current.has(key)) return null;
            const active = dataset.id === activeDataset && tab.id === activeTab;
            return (
              <div key={key} className={active ? styles.panelActive : styles.panelHidden}>
                <ChartPanel config={tab} dataset={dataset} active={active} />
              </div>
            );
          }),
        )}
      </main>
    </div>
  );
}
