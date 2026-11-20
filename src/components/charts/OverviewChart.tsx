import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useElementSize } from '@/hooks/useElementSize';
import { useFormat } from '@/hooks/useFormat';
import { TIME_DAY, monotonePath, niceTicks, niceTimeTicks } from '@/lib/chart';
import { clamp, cn } from '@/lib/utils';
import type { OverviewData } from '@/types/domain';

interface OverviewChartProps {
  data: OverviewData;
  /** Series ids hidden through the legend toggles. */
  hidden: ReadonlySet<string>;
  /** The selected network's token: drawn thicker with a glow, like the reference's lead series. */
  emphasisId: string;
  /** Fade the chart while fresh data for another range is loading. */
  dimmed?: boolean;
}

const MARGIN = { top: 16, right: 22, bottom: 36, left: 56 } as const;
const FALLBACK = { width: 720, height: 300 } as const; // used until measured (and in jsdom tests)
const colorVar = (c: string): string => `var(--c-${c})`;

/**
 * The Overview chart: a hand-drawn SVG multi-series line chart.
 *
 * - Y axis is a performance INDEX (Base = 100 at the start of the selected range), so assets with very
 *   different prices share one honest axis; USD prices are in the tooltip.
 * - Hover / touch / arrow keys move a "spotlight" band with a glowing marker, echoing the reference.
 * - When nothing is hovered the band rests on the lead series' peak so the chart never looks inert.
 * - Everything is a pure function of `data`, so it is trivially testable and stable across refreshes.
 */
export function OverviewChart({ data, hidden, emphasisId, dimmed }: OverviewChartProps) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const uid = useId().replace(/:/g, '');
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const width = size.width || FALLBACK.width;
  const height = size.height || FALLBACK.height;

  const [hover, setHover] = useState<number | null>(null);
  const [kbd, setKbd] = useState<number | null>(null);

  const n = data.points.length;
  const plot = { x0: MARGIN.left, x1: width - MARGIN.right, y0: MARGIN.top, y1: height - MARGIN.bottom };
  const plotW = Math.max(40, plot.x1 - plot.x0);
  const plotH = Math.max(40, plot.y1 - plot.y0);
  const xAt = (i: number): number => plot.x0 + (n <= 1 ? 0 : (i / (n - 1)) * plotW);

  const visible = useMemo(() => data.series.map((s, i) => ({ s, i })).filter(({ s }) => !hidden.has(s.id)), [data.series, hidden]);

  const { ticks, yMin, yMax } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const { i } of visible)
      for (const p of data.points) {
        const v = p.v[i] as number;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    if (!Number.isFinite(lo)) {
      lo = 95;
      hi = 105;
    }
    const pad = (hi - lo) * 0.12 || 1;
    const ts = niceTicks(lo - pad, hi + pad, 6);
    return { ticks: ts, yMin: ts[0] as number, yMax: ts[ts.length - 1] as number };
  }, [data.points, visible]);

  const yAt = (v: number): number => plot.y1 - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const paths = useMemo(
    () =>
      visible.map(({ s, i }) => ({
        id: s.id,
        d: monotonePath(data.points.map((p, k) => [plot.x0 + (n <= 1 ? 0 : (k / (n - 1)) * plotW), plot.y1 - (((p.v[i] as number) - yMin) / (yMax - yMin || 1)) * plotH] as const)),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, data.points, width, height, yMin, yMax],
  );

  const leadIndex = Math.max(0, data.series.findIndex((s) => s.id === emphasisId && !hidden.has(s.id)));
  const lead = visible.find(({ s }) => s.id === emphasisId) ?? visible[0];
  const idleIndex = useMemo(() => {
    if (!lead) return Math.floor(n / 2);
    let best = 0;
    for (let k = 0; k < n; k++) if ((data.points[k]?.v[lead.i] as number) > (data.points[best]?.v[lead.i] as number)) best = k;
    return clamp(best, Math.floor(n * 0.2), Math.ceil(n * 0.85)); // keep the band away from the edges
  }, [data.points, lead, n]);

  const active = clamp(hover ?? kbd ?? idleIndex, 0, Math.max(0, n - 1));
  const showCard = hover !== null || kbd !== null;
  const activePoint = data.points[active];
  const ax = xAt(active);

  const bandW = clamp(plotW / 7, 52, 112);
  const bandX = clamp(ax - bandW / 2, plot.x0, plot.x1 - bandW);

  /* axis label formatting depends on the range */
  const xCount = clamp(Math.floor(plotW / 92), 3, 9);
  const t0 = data.points[0]?.t ?? 0;
  const t1 = data.points[n - 1]?.t ?? t0 + 1;
  const { ticks: xTicks, step: xStep } = niceTimeTicks(t0, t1, xCount);
  const xAtTime = (ts: number): number => plot.x0 + ((ts - t0) / (t1 - t0 || 1)) * plotW;
  const xLabel = (ts: number): string => (xStep >= TIME_DAY ? fmt.date(ts, { month: 'short', day: 'numeric' }) : fmt.time(ts, { hour: 'numeric', minute: '2-digit' }));
  const tipLabel = (ts: number): string =>
    data.range === '90D'
      ? fmt.date(ts, { month: 'short', day: 'numeric', year: 'numeric' })
      : fmt.dateTime(ts, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const yFraction = yMax - yMin < 8 ? 1 : 0;

  /* block grid under the lines (decorative, mirrors the reference) */
  const cols = Math.max(8, Math.floor(plotW / 64));
  const cellW = plotW / cols - 6;
  const cellH = clamp(plotH * 0.095, 14, 34);

  const onMove = (e: PointerEvent<SVGRectElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = rect.width ? (e.clientX - rect.left) / rect.width : 0;
    setKbd(null);
    setHover(clamp(Math.round(ratio * (n - 1)), 0, n - 1));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const current = kbd ?? idleIndex;
    let next: number;
    if (e.key === 'ArrowRight') next = current + 1;
    else if (e.key === 'ArrowLeft') next = current - 1;
    else if (e.key === 'PageUp') next = current + Math.max(1, Math.round(n / 10));
    else if (e.key === 'PageDown') next = current - Math.max(1, Math.round(n / 10));
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (e.key === 'Escape') {
      setKbd(null);
      return;
    } else return;
    e.preventDefault();
    setHover(null);
    setKbd(clamp(next, 0, n - 1));
  };

  const summary = data.stats
    .filter((s) => !hidden.has(s.id))
    .map((s) => `${s.id} ${fmt.signedPercent(s.change, 1)}`)
    .join(', ');

  const announce = activePoint
    ? `${tipLabel(activePoint.t)}: ${visible.map(({ s, i }) => `${s.symbol} ${fmt.decimal(activePoint.v[i] as number, 1)}`).join(', ')}`
    : '';

  /* tooltip placement: flip to the left of the crosshair on the right half */
  const cardW = 236;
  const cardLeft = ax > width * 0.55 ? ax - cardW - 16 : ax + 16;

  return (
    <div
      ref={wrapRef}
      dir="ltr"
      role="group"
      tabIndex={0}
      aria-label={t('chart.keyboardHint')}
      onKeyDown={onKeyDown}
      onFocus={() => setKbd((k) => k ?? idleIndex)}
      onBlur={() => setKbd(null)}
      className="relative h-full min-h-[220px] w-full select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cyan/40"
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t('chart.summary', { range: data.range, details: summary })}
        className={cn('block overflow-visible transition-opacity duration-300', dimmed && 'opacity-60')}
      >
        <defs>
          <filter id={`${uid}-glow`} x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <linearGradient id={`${uid}-band`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--c-purple)" stopOpacity="0.02" />
            <stop offset="1" stopColor="var(--c-purple)" stopOpacity="0.24" />
          </linearGradient>
          <radialGradient id={`${uid}-halo`}>
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.45" stopColor="var(--c-purple)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--c-purple)" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${uid}-clip`}>
            <rect x={bandX} y={plot.y0 - 6} width={bandW} height={plotH + 12} rx="6" />
          </clipPath>
        </defs>

        {/* y grid + labels */}
        <g aria-hidden="true">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={plot.x0} x2={plot.x1} y1={yAt(v)} y2={yAt(v)} stroke="var(--c-line)" strokeOpacity="0.55" strokeDasharray="2 7" />
              <text x={plot.x0 - 12} y={yAt(v)} textAnchor="end" dominantBaseline="central" fontSize="11" fill="var(--c-fg-3)" className="tabular-nums">
                {fmt.decimal(v, yFraction)}
              </text>
            </g>
          ))}
        </g>

        {/* decorative block grid */}
        <g aria-hidden="true">
          {[0, 1, 2].flatMap((r) =>
            Array.from({ length: cols }, (_, c) => {
              const x = plot.x0 + c * (cellW + 6) + 3;
              const y = plot.y1 - (r + 1) * (cellH + 6) + 2;
              const near = Math.abs(x + cellW / 2 - ax) < bandW / 2;
              const base = 0.035 + 0.05 * (((c * 7 + r * 13) % 5) / 4);
              return <rect key={`${r}-${c}`} x={x} y={y} width={cellW} height={cellH} rx="5" fill="var(--c-purple)" opacity={near ? base * 2.8 : base} />;
            }),
          )}
        </g>

        {/* series */}
        <g key={`${data.range}`}>
          {paths.map(({ id, d }) => {
            const s = data.series.find((x) => x.id === id);
            if (!s) return null;
            const lead = id === emphasisId;
            return (
              <g key={id}>
                {lead ? <path d={d} fill="none" stroke={colorVar(s.color)} strokeWidth="11" strokeLinecap="round" opacity="0.5" filter={`url(#${uid}-glow)`} /> : null}
                <path d={d} fill="none" stroke={colorVar(s.color)} strokeWidth={lead ? 3.8 : 2.2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="chart-draw" data-series={id} opacity={lead ? 1 : 0.92} />
              </g>
            );
          })}
        </g>

        {/* spotlight band */}
        <g aria-hidden="true">
          <rect x={bandX} y={plot.y0 - 6} width={bandW} height={plotH + 12} rx="6" fill={`url(#${uid}-band)`} stroke="var(--c-purple)" strokeOpacity="0.22" />
          <g clipPath={`url(#${uid}-clip)`}>
            {paths.map(({ id, d }) => {
              const s = data.series.find((x) => x.id === id);
              if (!s) return null;
              return <path key={id} d={d} fill="none" stroke={colorVar(s.color)} strokeWidth={id === emphasisId ? 6.5 : 4.2} strokeLinecap="round" opacity={id === emphasisId ? 0.95 : 0.7} />;
            })}
          </g>
          <line x1={ax} x2={ax} y1={plot.y0 - 6} y2={plot.y1 + 6} stroke="var(--c-fg)" strokeOpacity="0.38" />
          {activePoint
            ? visible.map(({ s, i }) => {
                const cy = yAt(activePoint.v[i] as number);
                const isLead = s.id === emphasisId || (i === leadIndex && !visible.some((v) => v.s.id === emphasisId));
                return (
                  <g key={s.id}>
                    {isLead ? <circle cx={ax} cy={cy} r="20" fill={`url(#${uid}-halo)`} /> : null}
                    <circle cx={ax} cy={cy} r={isLead ? 6 : 4.5} fill={isLead ? '#fff' : colorVar(s.color)} stroke={isLead ? colorVar(s.color) : 'var(--c-panel)'} strokeWidth={isLead ? 2.5 : 2} />
                  </g>
                );
              })
            : null}
        </g>

        {/* x labels */}
        <g aria-hidden="true">
          {xTicks.map((ts) => (
            <text key={ts} x={xAtTime(ts)} y={height - 12} textAnchor="middle" fontSize="11" fill="var(--c-fg-3)" className="tabular-nums">
              {xLabel(ts)}
            </text>
          ))}
        </g>

        {/* pointer capture layer */}
        <rect
          x={plot.x0}
          y={plot.y0 - 6}
          width={plotW}
          height={plotH + 12}
          fill="transparent"
          style={{ touchAction: 'pan-y', cursor: 'crosshair' }}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={(e) => {
            if (e.pointerType !== 'touch') setHover(null);
          }}
          data-testid="chart-surface"
        />
      </svg>

      {showCard && activePoint ? (
        <div
          aria-hidden="true"
          className="glass-pop pointer-events-none absolute top-1 z-10 rounded-xl p-3 text-[12px]"
          style={{ left: clamp(cardLeft, 4, Math.max(4, width - cardW - 4)), width: cardW }}
        >
          <p className="mb-2 text-[11.5px] text-fg-3">{tipLabel(activePoint.t)}</p>
          <ul className="space-y-1.5">
            {visible.map(({ s, i }) => {
              const v = activePoint.v[i] as number;
              const change = v / 100 - 1;
              return (
                <li key={s.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2.5">
                  <span className="flex items-center gap-1.5 font-semibold text-fg">
                    <i className="size-2 rounded-full" style={{ background: colorVar(s.color) }} />
                    {s.symbol}
                  </span>
                  <span className="tabular-nums text-fg">{fmt.decimal(v, 1)}</span>
                  <span className="tabular-nums text-fg-3">{fmt.usdCompact(activePoint.p[i] as number)}</span>
                  <span className={cn('min-w-[52px] text-end tabular-nums', change >= 0 ? 'text-green' : 'text-red')}>{fmt.signedPercent(change, 1)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {kbd !== null ? announce : ''}
      </p>
    </div>
  );
}
