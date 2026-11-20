import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Coins, TrendingDown, TrendingUp, Landmark } from 'lucide-react';
import { createColumnHelper } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { AXIS_LINE, AXIS_TICK, ChartTooltip, GRID_STROKE } from '@/components/charts/ChartTooltip';
import { ChartKey } from '@/components/charts/ChartKey';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { Sparkline } from '@/components/charts/Sparkline';
import { DataTable } from '@/components/data/DataTable';
import { Badge } from '@/components/ui/Badge';
import { DemoBadge } from '@/components/ui/Demo';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { useMarket, usePriceHistory, useVolumeHistory } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { TIME_DAY, niceTimeTicks } from '@/lib/chart';
import { cn } from '@/lib/utils';
import { RANGES, type MarketRow, type Range } from '@/types/domain';

const col = createColumnHelper<MarketRow>();
type Metric = 'price' | 'cap' | 'volume';
const METRICS: readonly Metric[] = ['price', 'cap', 'volume'];

export default function MarketPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState('ATOM');
  const [range, setRange] = useState<Range>('7D');
  const [metric, setMetric] = useState<Metric>('price');
  const [compare, setCompare] = useState('none');
  const market = useMarket();
  const rows = useMemo(() => market.data ?? [], [market.data]);
  const comparing = compare !== 'none' && compare !== selected && rows.some((r) => r.symbol === compare);
  const history = usePriceHistory(selected, range);
  const other = usePriceHistory(comparing ? compare : selected, range);
  const volume = useVolumeHistory(selected, range, metric === 'volume' && !comparing);
  const current = rows.find((r) => r.symbol === selected);
  const supply = current && current.priceUsd > 0 ? current.marketCapUsd / current.priceUsd : 0;

  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const sorted = [...rows].sort((a, b) => b.change24h - a.change24h);
    return { gainer: sorted[0] as MarketRow, loser: sorted[sorted.length - 1] as MarketRow, cap: rows.reduce((a, r) => a + r.marketCapUsd, 0) };
  }, [rows]);

  const columns = useMemo(
    () => [
      col.accessor('symbol', {
        header: t('tokens.col.token'),
        cell: ({ row }) => (
          <button type="button" onClick={() => setSelected(row.original.symbol)} aria-pressed={row.original.symbol === selected} className="flex min-w-[130px] items-center gap-2.5 text-start">
            <span className="grid size-7 place-items-center rounded-full text-[10px] font-bold text-[var(--c-canvas)]" style={{ background: `var(--c-${row.original.color})` }} aria-hidden>
              {row.original.symbol.slice(0, 2)}
            </span>
            <span>
              <span className={cn('block font-semibold', row.original.symbol === selected ? 'text-cyan' : 'text-fg')}>{row.original.symbol}</span>
              <span className="block text-[11px] text-fg-3">{row.original.name}</span>
            </span>
          </button>
        ),
      }),
      col.accessor('priceUsd', { header: t('tokens.col.price'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums text-fg">{fmt.currency(c.getValue(), 'USD', { maximumFractionDigits: c.getValue() < 1 ? 4 : 2 })}</span> }),
      col.accessor('change24h', { header: t('market.change24h'), meta: { align: 'end' }, cell: (c) => <span className={cn('tabular-nums', c.getValue() >= 0 ? 'text-green' : 'text-red')}>{fmt.signedPercent(c.getValue(), 2)}</span> }),
      col.accessor('change7d', { header: t('market.change7d'), meta: { align: 'end' }, cell: (c) => <span className={cn('tabular-nums', c.getValue() >= 0 ? 'text-green' : 'text-red')}>{fmt.signedPercent(c.getValue(), 2)}</span> }),
      col.accessor('marketCapUsd', { header: t('tokens.col.marketCap'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums">{fmt.usdCompact(c.getValue())}</span> }),
      col.accessor('volume24hUsd', { header: t('market.volume'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums">{fmt.usdCompact(c.getValue())}</span> }),
      col.display({
        id: 'spark',
        header: t('market.chart7d'),
        enableSorting: false,
        meta: { align: 'end' },
        cell: ({ row }) => <div className="ms-auto w-[96px]"><Sparkline values={row.original.spark} height={28} color={row.original.change7d >= 0 ? 'var(--c-green)' : 'var(--c-red)'} area /></div>,
      }),
    ],
    [t, fmt, selected],
  );

  // one series per mode: indexed lines when comparing, bars for volume, an area for price / market cap
  const data = useMemo<Array<{ t: number; v?: number; a?: number; b?: number | null }>>(() => {
    const base = history.data ?? [];
    if (comparing) {
      const b = other.data ?? [];
      const a0 = base[0]?.v || 1;
      const b0 = b[0]?.v || 1;
      return base.map((p, i) => ({ t: p.t, a: (p.v / a0) * 100, b: b[i] ? (b[i].v / b0) * 100 : null }));
    }
    if (metric === 'volume') return (volume.data ?? []).map((p) => ({ t: p.t, v: p.v }));
    return base.map((p) => ({ t: p.t, v: metric === 'cap' ? p.v * supply : p.v }));
  }, [history.data, other.data, volume.data, comparing, metric, supply]);
  const pending = history.isLoading || (comparing && other.isLoading) || (metric === 'volume' && !comparing && volume.isLoading);
  const failed = (history.isError && !history.data) || (metric === 'volume' && !comparing && volume.isError && !volume.data);
  const stroke = current && current.change24h < 0 ? 'var(--c-red)' : 'var(--c-cyan)';
  const money = (v: number): string => (metric === 'price' ? fmt.currency(v, 'USD', { maximumFractionDigits: v < 1 ? 4 : 2 }) : fmt.usdCompact(v));
  const shares = useMemo(() => {
    const total = rows.reduce((a, r) => a + r.marketCapUsd, 0) || 1;
    return [...rows].sort((a, b) => b.marketCapUsd - a.marketCapUsd).map((r) => ({ symbol: r.symbol, color: r.color, share: r.marketCapUsd / total }));
  }, [rows]);
  const first = data[0]?.t ?? 0;
  const last = data[data.length - 1]?.t ?? 1;

  const { ticks: xTicks, step: xStep } = niceTimeTicks(first, last, 7);
  const xAxis = (
    <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} ticks={xTicks} interval={0} tickFormatter={(v: number) => (xStep >= TIME_DAY ? fmt.date(v, { month: 'short', day: 'numeric' }) : fmt.time(v, { hour: 'numeric', minute: '2-digit' }))} />
  );
  const when = (l: unknown): string => fmt.dateTime(Number(l), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const margin = { top: 8, right: 12, bottom: 0, left: 0 };

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.market')} description={t('market.description')} badge={<DemoBadge label={t('common.simulated')} />} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Coins} label={t('market.tracked')} value={fmt.integer(rows.length)} loading={market.isLoading} />
        <StatCard icon={Landmark} label={t('market.totalCap')} value={stats ? fmt.usdCompact(stats.cap) : '–'} loading={market.isLoading} />
        <StatCard icon={TrendingUp} label={t('market.topGainer')} value={stats ? stats.gainer.symbol : '–'} hint={stats ? fmt.signedPercent(stats.gainer.change24h, 2) : undefined} loading={market.isLoading} />
        <StatCard icon={TrendingDown} label={t('market.topLoser')} value={stats ? stats.loser.symbol : '–'} hint={stats ? fmt.signedPercent(stats.loser.change24h, 2) : undefined} loading={market.isLoading} />
      </div>

      <ChartPanel
        title={
          <span className="flex flex-wrap items-center gap-2">
            {comparing ? `${selected} / ${compare}` : selected}{' '}
            <Badge tone="neutral">{comparing ? t('market.indexed') : metric === 'price' ? t('market.priceUsd') : t(`market.metric.${metric}`)}</Badge>
            {current && !comparing ? <span className="text-[13px] font-medium tabular-nums text-fg-2">{fmt.currency(current.priceUsd, 'USD', { maximumFractionDigits: current.priceUsd < 1 ? 4 : 2 })}</span> : null}
          </span>
        }
        description={comparing ? t('market.indexedNote') : metric === 'volume' ? t('market.volumeNote') : t('market.chartDescription')}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {comparing ? <ChartKey items={[{ label: selected, color: 'var(--c-cyan)', shape: 'solid' }, { label: compare, color: 'var(--c-yellow)', shape: 'dashed' }]} /> : null}
            {comparing ? null : <Segmented aria-label={t('market.metric.label')} size="sm" value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m, label: t(`market.metric.${m}`) }))} />}
            <Select
              variant="ghost"
              aria-label={t('market.compareWith')}
              value={compare}
              onValueChange={setCompare}
              options={[{ value: 'none', label: t('market.compareNone') }, ...rows.filter((r) => r.symbol !== selected).map((r) => ({ value: r.symbol, label: r.symbol }))]}
            />
            <Segmented aria-label={t('chart.rangeLabel')} size="sm" value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r, label: t(`chart.range.${r}`), ariaLabel: t(`chart.rangeLong.${r}`) }))} />
          </div>
        }
        height={300}
        loading={pending}
        error={failed}
        onRetry={() => void history.refetch()}
        label={comparing ? t('market.compareLabel', { a: selected, b: compare, range }) : metric === 'price' ? t('market.chartLabel', { symbol: selected, range }) : t('market.chartLabelMetric', { metric: t(`market.metric.${metric}`), symbol: selected, range })}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 300 }}>
          {comparing ? (
            <LineChart data={data} margin={margin}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" vertical={false} />
              {xAxis}
              <YAxis domain={['auto', 'auto']} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => fmt.number(v, { maximumFractionDigits: 0 })} />
              <RTooltip content={<ChartTooltip labelFormatter={when} valueFormatter={(v) => fmt.number(Number(v), { maximumFractionDigits: 1 })} />} cursor={{ stroke: 'var(--c-fg-3)', strokeDasharray: '3 4' }} />
              <Line type="monotone" dataKey="a" name={selected} stroke="var(--c-cyan)" strokeWidth={2.2} dot={false} isAnimationActive={!reduced} />
              <Line type="monotone" dataKey="b" name={compare} stroke="var(--c-yellow)" strokeWidth={2.2} strokeDasharray="6 4" dot={false} connectNulls isAnimationActive={!reduced} />
            </LineChart>
          ) : metric === 'volume' ? (
            <BarChart data={data} margin={margin}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" vertical={false} />
              {xAxis}
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} tickFormatter={(v: number) => fmt.usdCompact(v)} />
              <RTooltip content={<ChartTooltip labelFormatter={when} valueFormatter={(v) => money(Number(v))} />} cursor={{ fill: 'var(--c-hover)' }} />
              <Bar dataKey="v" name={t('market.metric.volume')} fill="var(--c-blue)" radius={[3, 3, 0, 0]} isAnimationActive={!reduced} />
            </BarChart>
          ) : (
            <AreaChart data={data} margin={margin}>
              <defs>
                <linearGradient id="mkt-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={stroke} stopOpacity={0.35} />
                  <stop offset="1" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" vertical={false} />
              {xAxis}
              <YAxis domain={['auto', 'auto']} tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} tickFormatter={(v: number) => fmt.usdCompact(v)} />
              <RTooltip content={<ChartTooltip labelFormatter={when} valueFormatter={(v) => money(Number(v))} />} cursor={{ stroke: 'var(--c-fg-3)', strokeDasharray: '3 4' }} />
              <Area type="monotone" dataKey="v" name={metric === 'cap' ? t('market.metric.cap') : selected} stroke={stroke} strokeWidth={2.2} fill="url(#mkt-fill)" isAnimationActive={!reduced} animationDuration={450} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </ChartPanel>

      <Panel className="p-4">
        <PanelHeader title={t('market.dominanceTitle')} subtitle={t('market.dominanceHint')} />
        <div
          className="mt-3 flex h-3 overflow-hidden rounded-full bg-card-hi"
          role="img"
          aria-label={t('market.dominanceLabel', { list: shares.slice(0, 4).map((s) => `${s.symbol} ${fmt.percent(s.share, 1)}`).join(', ') })}
        >
          {shares.map((s) => (
            <span key={s.symbol} className="h-full border-e border-[var(--c-canvas)] last:border-e-0" style={{ width: `${s.share * 100}%`, background: `var(--c-${s.color})` }} />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-3 lg:grid-cols-4">
          {shares.map((s) => (
            <li key={s.symbol} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-fg-2">
                <span className="size-2.5 rounded-sm" style={{ background: `var(--c-${s.color})` }} aria-hidden />
                {s.symbol}
              </span>
              <span className="tabular-nums text-fg">{fmt.percent(s.share, 1)}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="p-4">
        <DataTable data={rows} columns={columns} caption={t('market.tableCaption')} loading={market.isLoading} error={market.isError && !market.data} onRetry={() => void market.refetch()} pageSize={10} initialSort={[{ id: 'marketCapUsd', desc: true }]} getRowId={(r) => r.symbol} minWidth={860} />
      </Panel>
    </div>
  );
}
