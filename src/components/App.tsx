import { useState, useRef } from 'react';
import { TabBar } from './TabBar';
import { ChartPanel } from './ChartPanel';
import { TABS } from '../lib/tabs';
import styles from '../styles/App.module.css';

export function App() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const visitedTabs = useRef<Set<string>>(new Set([TABS[0].id]));

  const handleTabChange = (tabId: string) => {
    visitedTabs.current.add(tabId);
    setActiveTab(tabId);
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Ebonhold Compendium</h1>
        <p>Frost Death Knight</p>
      </header>
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
      <main className={styles.main}>
        {TABS.map(tab =>
          visitedTabs.current.has(tab.id) ? (
            <div
              key={tab.id}
              className={tab.id === activeTab ? styles.panelActive : styles.panelHidden}
            >
              <ChartPanel config={tab} />
            </div>
          ) : null
        )}
      </main>
    </div>
  );
}
