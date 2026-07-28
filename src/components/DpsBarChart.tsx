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

const Y_AXIS_WIDTH = 600;

interface YTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  entries: ChartEntry[];
}

function WowheadYTick({ x = 0, y = 0, payload, entries }: YTickProps) {
  console.log(payload);
  console.log(entries);
  const entry = entries.find(e => e.label === payload?.value);
  const tickHeight = 35;

  const renderItems = (items: ChartItemRef[]) =>
    items.map((item, i) => (
      <span key={item.itemId}>
        {i > 0 && <span style={{ color: '#666' }}> + </span>}
        <a
          href={`https://www.wowhead.com/item=${item.itemId}?bonus=${item.bonusId?.join(':')}`}
        >
          {item.name} ({item.itemLevel})
        </a>
      </span>
    ));

  return (
    <foreignObject
      x={x - Y_AXIS_WIDTH}
      y={y - tickHeight / 2}
      width={Y_AXIS_WIDTH}
      height={tickHeight}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          height: '100%',
          fontSize: 16,
          overflow: 'hidden',
        }}
      >
        {entry ? renderItems(entry.items) : payload?.value}
      </div>
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
  return (
    <Rectangle
      x={x}
      y={y}
      width={Math.max(0, width)}
      height={Math.max(0, height)}
      fill={(payload?.delta ?? 0) >= 0 ? '#4caf50' : '#f44336'}
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

  const chartHeight = Math.max(300, entries.length * 40);
  const chartData = entries;

  return (
    <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
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
          tick={<WowheadYTick entries={entries} />}
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
            style={{ fontSize: 11, fill: '#ccc' }}
            formatter={(v: number) => Math.round(v).toLocaleString()}
          />
        </Bar>
      </BarChart>
    </div>
  );
}
