import type { TabConfig } from '../lib/tabs';
import styles from '../styles/TabBar.module.css';

interface Props {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: Props) {
  return (
    <nav className={styles.tabBar} role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTab}
          className={tab.id === activeTab ? styles.tabActive : styles.tab}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
