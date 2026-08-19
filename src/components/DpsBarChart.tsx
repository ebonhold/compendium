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
// A catalyst source roughly doubles a line's text ("Casque (334)" becomes
// "Casque (334) | (Skullguard of the Risen Sacrifice)"), which overruns the
// narrow axis and ellipsises away the very thing the base item is there to show.
// Keyed off the data rather than the tab, so any category carrying conversions
// gets the room. Sized against the longest measured line plus headroom, counting
// the icon Wowhead prepends to each link (whTooltips.iconizeLinks in index.html).
const Y_AXIS_WIDTH_WITH_BASE = 580;
const LINE_HEIGHT = 22;
// Keep in sync with the .yTick padding in DpsBarChart.module.css — this is
// the visible gap between rows, since adjacent rows' foreignObjects are flush.
const ROW_GAP = 8;

// Every bar is scored as a percentage of the best-known-profile baseline, so the
// strongest entry sits at (or just past) 100%.
const formatPercent = (v: number) => `${v.toFixed(2)}%`;

// Each row renders a foreignObject holding a Wowhead link per item, so a
// 2700-row category would build several thousand live DOM nodes before first
// paint. Rows arrive a page at a time instead, and the chart grows as it scrolls.
const PAGE_SIZE = 50;
// Grow before the sentinel is actually reached, so scrolling never stalls at the
// bottom waiting on a render.
const PRELOAD_MARGIN_PX = 400;

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
  axisWidth: number;
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

function WowheadYTick({ x = 0, y = 0, payload, entries, rowHeight, axisWidth }: YTickProps) {
  const entry = entries.find(e => e.id === payload?.value);

  const renderItems = (items: ChartItemRef[]) => {
    const prefix = sharedNamePrefix(items);
    return items.map((item, index) => {
      const name = prefix && item.name.startsWith(`${prefix} `) && item.name.length > 29
        ? item.name.slice(prefix.length + 1)
        : item.name;
      const full = item.baseName
        ? `${item.name} (${item.baseName})`
        : `${item.name} `;
      return (
        // Not keyed on itemId alone — a row can hold the same item in both
        // finger slots. Position within the row is stable, so index completes it.
        <div key={`${item.itemId}-${index}`} className={styles.yTickLine} title={full}>
          <a
            href={`https://www.wowhead.com/item=${item.itemId}?bonus=${item.bonusId?.join(':')}`}
          >
            {name}
          </a>
          {/* Its own anchor rather than text inside the one above — it is a
              different item and gets its own tooltip. No bonus params: the JSON
              gives a bare id for the base stats source, not a full gear entry. */}
          {item.baseName && (
            <span className={styles.baseItem}>
              {' ('}
              <a href={`https://www.wowhead.com/item=${item.baseItemId}`}>{item.baseName}</a>
              {')'}
            </span>
          )}
        </div>
      );
    });
  };

  return (
    <foreignObject
      x={x - axisWidth}
      y={y - rowHeight / 2}
      width={axisWidth}
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
  /**
   * Whether this chart's panel is the one on screen. Hidden panels are only
   * `visibility: hidden`, so they still have layout and their sentinel would
   * otherwise keep paging rows in off-screen — the exact cost paging avoids.
   */
  active: boolean;
}

declare const $WowheadPower: { refreshLinks: () => void } | undefined;

export function DpsBarChart({ entries, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(950);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
    setVisibleCount(PAGE_SIZE);
  }, [entries]);

  const hasMore = visibleCount < entries.length;

  // Re-created on every page rather than left running: the sentinel usually
  // stays intersecting after rows are appended, and IntersectionObserver only
  // reports *changes* — a persistent observer would fire once and then stall.
  // A fresh observer re-reports on attach, so pages chain until the sentinel
  // is pushed out of range.
  useEffect(() => {
    const root = containerRef.current;
    const sentinel = sentinelRef.current;
    if (!active || !hasMore || !root || !sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount(c => Math.min(c + PAGE_SIZE, entries.length));
        }
      },
      { root, rootMargin: `0px 0px ${PRELOAD_MARGIN_PX}px 0px` },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [active, hasMore, visibleCount, entries.length]);

  useEffect(() => {
    if (typeof $WowheadPower !== 'undefined') {
      $WowheadPower.refreshLinks();
    }
  }, [entries, visibleCount]);

  const chartData = entries.slice(0, visibleCount);

  // Row height and axis bounds are derived from the *whole* set, not the loaded
  // slice, so neither the row rhythm nor the scale shifts underneath the user as
  // later pages arrive.
  const maxItems = Math.max(1, ...entries.map(e => e.items.length));
  const rowHeight = Math.max(40, maxItems * LINE_HEIGHT + ROW_GAP * 2);
  const chartHeight = Math.max(300, chartData.length * rowHeight);
  const hasBaseItems = entries.some(e => e.items.some(i => i.baseName));
  const axisWidth = hasBaseItems ? Y_AXIS_WIDTH_WITH_BASE : Y_AXIS_WIDTH;

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
          dataKey="id"
          width={axisWidth}
          tick={<WowheadYTick entries={chartData} rowHeight={rowHeight} axisWidth={axisWidth} />}
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
      {hasMore && (
        <div ref={sentinelRef} className={styles.sentinel}>
          Loading more… {chartData.length} of {entries.length}
        </div>
      )}
    </div>
  );
}
