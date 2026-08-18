import { useEffect, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  LabelList,
  Rectangle,
} from 'recharts';
import type { ChartEntry, ChartItemRef } from '../lib/parseProfileset';
import styles from '../styles/DpsBarChart.module.css';

const Y_AXIS_WIDTH = 280;
const LINE_HEIGHT = 22;
// Keep in sync with the .yTick padding in DpsBarChart.module.css — this is
// the visible gap between rows, since adjacent rows' foreignObjects are flush.
const ROW_GAP = 8;

// Every bar is scored as a percentage of the best-known-profile baseline, so the
// strongest entry sits at (or just past) 100%.
const formatPercent = (v: number) => `${v.toFixed(2)}%`;

const FLOOR_STEPS = [0.5, 1, 2.5, 5, 10, 25];

/**
 * Round number to anchor the left edge of the axis. Starting at 0 would make
 * every bar look nearly full; starting exactly at the weakest entry would give
 * it zero width. Flooring to a step scaled off the spread keeps the shortest bar
 * visible whether entries span 0.3% or 20%.
 */
function axisFloor(minPercent: number): number {
  const span = Math.max(100 - minPercent, 0.5);
  const step = FLOOR_STEPS.find(s => s >= span / 3) ?? FLOOR_STEPS[FLOOR_STEPS.length - 1];
  return Math.max(0, Math.floor(minPercent / step) * step);
}

interface YTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  entries: ChartEntry[];
  rowHeight: number;
}

// Items in a row often share a leading set-name, e.g. "Relentless Rider's Crown"
// and "Relentless Rider's Cuirass" — stripping that shared prefix keeps each
// line short enough to fit without clipping.
function sharedNamePrefix(items: ChartItemRef[]): string | null {
  const distinctNames = [...new Set(items.map(i => i.name))];
  if (distinctNames.length < 2) return null;
  const counts = new Map<string, number>();
  for (const name of distinctNames) {
    const words = name.split(' ');
    const prefix = words.slice(0, Math.min(2, words.length - 1)).join(' ');
    if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 1;
  for (const [prefix, count] of counts) {
    if (count > bestCount) {
      best = prefix;
      bestCount = count;
    }
  }
  return best;
}

function WowheadYTick({ x = 0, y = 0, payload, entries, rowHeight }: YTickProps) {
  const entry = entries.find(e => e.id === payload?.value);

  const renderItems = (items: ChartItemRef[]) => {
    const prefix = sharedNamePrefix(items);
    return items.map(item => {
      const name = prefix && item.name.startsWith(`${prefix} `) && item.name.length > 29
        ? item.name.slice(prefix.length + 1)
        : item.name;
      return (
        <div key={item.itemId} className={styles.yTickLine}>
          <a
            href={`https://www.wowhead.com/item=${item.itemId}?bonus=${item.bonusId?.join(':')}`}
            title={`${item.name} (${item.itemLevel})`}
          >
            {name} ({item.itemLevel})
          </a>
        </div>
      );
    });
  };

  return (
    <foreignObject
      x={x - Y_AXIS_WIDTH}
      y={y - rowHeight / 2}
      width={Y_AXIS_WIDTH}
      height={rowHeight}
    >
      <div className={styles.yTick}>{entry ? renderItems(entry.items) : payload?.value}</div>
    </foreignObject>
  );
}

interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ChartEntry;
}

function DeltaBar({ x = 0, y = 0, width = 0, height = 0, payload }: BarShapeProps) {
  // Almost everything falls short of the best known profile, so shortfall is the
  // normal case and gets the neutral fill. Green is reserved for an entry that
  // matches or beats the baseline — a sign the baseline profile is out of date.
  const meetsBaseline = (payload?.percentOfBaseline ?? 0) >= 100;
  return (
    <Rectangle
      x={x}
      y={y}
      width={Math.max(0, width)}
      height={Math.max(0, height)}
      className={meetsBaseline ? styles.barPositive : styles.barNeutral}
    />
  );
}

interface Props {
  entries: ChartEntry[];
}

declare const $WowheadPower: { refreshLinks: () => void } | undefined;

export function DpsBarChart({ entries }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(950);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(items => {
      const w = items[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (typeof $WowheadPower !== 'undefined') {
      $WowheadPower.refreshLinks();
    }
  }, [entries]);

  const maxItems = Math.max(1, ...entries.map(e => e.items.length));
  const rowHeight = Math.max(40, maxItems * LINE_HEIGHT + ROW_GAP * 2);
  const chartHeight = Math.max(300, entries.length * rowHeight);
  const chartData = entries;

  // Entries are sorted descending, so the ends of the array bound the scale.
  const percents = entries.map(e => e.percentOfBaseline);
  const floor = axisFloor(Math.min(100, ...percents));
  const ceiling = Math.max(100, ...percents);

  return (
    <div ref={containerRef} className={styles.container}>
      <BarChart
        layout="vertical"
        width={containerWidth}
        height={chartHeight}
        data={chartData}
        margin={{ top: 30, right: 45, left: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          domain={[floor, ceiling]}
          tickFormatter={formatPercent}
          orientation="top"
        />
        <YAxis
          type="category"
          dataKey="label"
          width={Y_AXIS_WIDTH}
          tick={<WowheadYTick entries={entries} rowHeight={rowHeight} />}
        />
        <ReferenceLine x={100} stroke="#888" strokeDasharray="4 2" />
        {/* Recharts anchors bars at the axis domain's lower bound when the
            domain does not span zero, so `floor` is already the bar base. */}
        <Bar
          dataKey="percentOfBaseline"
          isAnimationActive={false}
          barSize={18}
          shape={<DeltaBar />}
        >
          <LabelList
            dataKey="percentOfBaseline"
            position="right"
            className={styles.dpsLabel}
            formatter={formatPercent}
          />
        </Bar>
      </BarChart>
    </div>
  );
}
