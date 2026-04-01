export interface TabConfig {
  id: string;
  label: string;
  filename: string;
  filterCulled: boolean;
}

export const TABS: TabConfig[] = [
  { id: 'embellishments', label: 'Embellishments', filename: 'embellished_1.json', filterCulled: true },
  { id: 'jewelry',        label: 'Jewelry',        filename: 'jewelry_1.json',     filterCulled: false },
  { id: 'other',          label: 'Other',          filename: 'other_1.json',       filterCulled: false },
  { id: 'tier-set',       label: 'Tier Set',       filename: 'tier_set_1.json',    filterCulled: false },
  { id: 'trinkets',       label: 'Trinkets',       filename: 'trinkets_1.json',    filterCulled: false },
  { id: 'weapons',        label: 'Weapons',        filename: 'weapons_1.json',     filterCulled: false },
];
