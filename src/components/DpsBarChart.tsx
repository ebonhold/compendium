import { useEffect, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  LabelList,
  Rectangle,
} from 'recharts';
import type { ChartEntry, ChartItemRef } from '../lib/parseProfileset';
import styles from '../styles/DpsBarChart.module.css';

const Y_AXIS_WIDTH = 280;
const LINE_HEIGHT = 18;
// Keep in sync with the .yTick padding in DpsBarChart.module.css — this is
// the visible gap between rows, since adjacent rows' foreignObjects are flush.
const ROW_GAP = 6;

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
  const entry = entries.find(e => e.label === payload?.value);

  const renderItems = (items: ChartItemRef[]) => {
    const prefix = sharedNamePrefix(items);
    return items.map(item => {
      const name = prefix && item.name.startsWith(`${prefix} `)
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
  const positive = (payload?.delta ?? 0) >= 0;
  return (
    <Rectangle
      x={x}
      y={y}
      width={Math.max(0, width)}
      height={Math.max(0, height)}
      className={positive ? styles.barPositive : styles.barNegative}
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
          domain={[0, 'auto']}
          tickFormatter={v => `+${v.toFixed(2)}%`}
          orientation="top"
        />
        <YAxis
          type="category"
          dataKey="label"
          width={Y_AXIS_WIDTH}
          tick={<WowheadYTick entries={entries} rowHeight={rowHeight} />}
        />
        <Tooltip
          formatter={(_: number, __: string, props: { payload?: { percentDiff?: number; absoluteDps?: number } }) => {
            const pct = props.payload?.percentDiff ?? 0;
            const abs = props.payload?.absoluteDps ?? 0;
            return [
              `+${pct.toFixed(2)}% (${Math.round(abs).toLocaleString()} DPS)`,
              'Delta',
            ];
          }}
        />
        <ReferenceLine x={0} stroke="#888" strokeDasharray="4 2" />
        <Bar dataKey="percentDiff" isAnimationActive={false} barSize={18} shape={<DeltaBar />}>
          <LabelList
            dataKey="absoluteDps"
            position="right"
            className={styles.dpsLabel}
            formatter={(v: number) => Math.round(v).toLocaleString()}
          />
        </Bar>
      </BarChart>
    </div>
  );
}
