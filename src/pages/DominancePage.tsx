import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Crown, Gauge, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AXIS_LINE, AXIS_TICK, ChartTooltip, GRID_STROKE } from '@/components/charts/ChartTooltip';
import { ChartKey } from '@/components/charts/ChartKey';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { DemoBadge } from '@/components/ui/Demo';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { StatCard } from '@/components/ui/StatCard';
import { useDominanceTrend, useMarket, useValidators } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hhi, powerCoefficient } from '@/lib/consensus';
import { useChain } from '@/stores/chainStore';

const ramp = (i: number): string => `hsl(${205 + i * 17} 72% ${62 - Math.min(i, 8) * 2}%)`;

export default function DominancePage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const reduced = useReducedMotion();
  const validators = useValidators();
  const market = useMarket();
  const trend = useDominanceTrend();
  const [view, setView] = useState<'donut' | 'stacked'>('donut');
  const viewSwitch = <Segmented aria-label={t('dominancePage.view')} size="sm" value={view} onChange={setView} options={[{ value: 'donut', label: t('dominancePage.donut') }, { value: 'stacked', label: t('dominancePage.stacked') }]} />;
  const first = trend.data?.[0];
  const last = trend.data?.[trend.data.length - 1];

  const active = useMemo(() => (validators.data ?? []).filter((v) => v.status === 'active'), [validators.data]);

  const power = useMemo(() => {
    const top = active.slice(0, 8).map((v, i) => ({ name: v.moniker, value: v.votingPower, fill: ramp(i) }));
    const rest = 1 - top.reduce((a, s) => a + s.value, 0);
    return rest > 0 ? [...top, { name: t('dominancePage.others'), value: rest, fill: 'var(--c-line-strong)' }] : top;
  }, [active, t]);

  const cumulative = useMemo(() => active.map((v, i) => ({ rank: i + 1, share: v.cumulativePower })), [active]);

  const caps = useMemo(() => {
    const rows = [...(market.data ?? [])].sort((a, b) => b.marketCapUsd - a.marketCapUsd);
    const total = rows.reduce((a, r) => a + r.marketCapUsd, 0) || 1;
    const top = rows.slice(0, 6).map((r, i) => ({ name: r.symbol, value: r.marketCapUsd / total, fill: ramp(i + 3) }));
    const rest = 1 - top.reduce((a, s) => a + s.value, 0);
    return rest > 0.0001 ? [...top, { name: t('dominancePage.others'), value: rest, fill: 'var(--c-line-strong)' }] : top;
  }, [market.data, t]);

  const index = hhi(active);
  const band = index < 1500 ? 'low' : index < 2500 ? 'moderate' : 'high';

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.dominance')} description={t('dominancePage.description', { chain: chain.name })} badge={<DemoBadge label={t('common.simulated')} />} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ShieldAlert} label={t('dominancePage.halt')} value={validators.data ? fmt.integer(powerCoefficient(active, 1 / 3)) : '–'} hint={t('dominancePage.haltHint')} loading={validators.isLoading} />
        <StatCard icon={ShieldCheck} label={t('dominancePage.majority')} value={validators.data ? fmt.integer(powerCoefficient(active, 1 / 2)) : '–'} hint={t('dominancePage.majorityHint')} loading={validators.isLoading} />
        <StatCard icon={Crown} label={t('dominancePage.super')} value={validators.data ? fmt.integer(powerCoefficient(active, 2 / 3)) : '–'} hint={t('dominancePage.superHint')} loading={validators.isLoading} />
        <StatCard icon={Gauge} label={t('dominancePage.hhi')} value={validators.data ? fmt.integer(index) : '–'} hint={t(`dominancePage.band.${band}`)} loading={validators.isLoading} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title={t('dominancePage.votingPower')} description={t('dominancePage.votingPowerHint')} actions={viewSwitch} height={300} loading={validators.isLoading} error={validators.isError && !validators.data} onRetry={() => void validators.refetch()} label={t('dominancePage.votingPower')}>
          <ShareChart data={power} format={(v) => fmt.percent(v, 2)} animate={!reduced} view={view} marks={[{ at: 1 / 3, label: fmt.percent(1 / 3, 1) }, { at: 2 / 3, label: fmt.percent(2 / 3, 1) }]} />
        </ChartPanel>
        <ChartPanel title={t('dominancePage.marketCap')} description={t('dominancePage.marketCapHint')} actions={viewSwitch} height={300} loading={market.isLoading} error={market.isError && !market.data} onRetry={() => void market.refetch()} label={t('dominancePage.marketCap')}>
          <ShareChart data={caps} format={(v) => fmt.percent(v, 1)} animate={!reduced} view={view} />
        </ChartPanel>
      </div>

      <ChartPanel
        title={t('dominancePage.trend')}
        actions={
          <ChartKey
            items={[
              { label: t('dominancePage.top', { n: 10 }), color: 'var(--c-purple)', shape: 'solid' },
              { label: t('dominancePage.top', { n: 5 }), color: 'var(--c-blue)', shape: 'dashed' },
              { label: t('dominancePage.top', { n: 1 }), color: 'var(--c-cyan)', shape: 'dotted' },
            ]}
          />
        }
        description={first && last ? t('dominancePage.trendSummary', { then: fmt.percent(first.top10, 1), now: fmt.percent(last.top10, 1), n: last.nakamoto }) : t('dominancePage.trendHint')}
        height={240}
        loading={trend.isLoading}
        error={trend.isError && !trend.data}
        onRetry={() => void trend.refetch()}
        label={first && last ? t('dominancePage.trendLabel', { then: fmt.percent(first.top10, 1), now: fmt.percent(last.top10, 1) }) : t('dominancePage.trend')}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 900, height: 240 }}>
          <LineChart data={trend.data ?? []} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v: number) => fmt.date(v, { month: 'short', day: 'numeric' })} minTickGap={36} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} domain={[0, 'auto']} tickFormatter={(v: number) => fmt.percent(v, 0)} />
            <RTooltip content={<ChartTooltip labelFormatter={(l) => fmt.date(Number(l), { dateStyle: 'medium' })} valueFormatter={(v) => fmt.percent(Number(v), 2)} />} />
            <Line type="monotone" dataKey="top10" name={t('dominancePage.top', { n: 10 })} stroke="var(--c-purple)" strokeWidth={2.2} dot={false} isAnimationActive={!reduced} />
            <Line type="monotone" dataKey="top5" name={t('dominancePage.top', { n: 5 })} stroke="var(--c-blue)" strokeWidth={2.2} strokeDasharray="6 4" dot={false} isAnimationActive={!reduced} />
            <Line type="monotone" dataKey="top1" name={t('dominancePage.top', { n: 1 })} stroke="var(--c-cyan)" strokeWidth={2.2} strokeDasharray="2 4" dot={false} isAnimationActive={!reduced} />
          </LineChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title={t('dominancePage.cumulative')} description={t('dominancePage.cumulativeHint')} height={280} loading={validators.isLoading} error={validators.isError && !validators.data} onRetry={() => void validators.refetch()} label={t('dominancePage.cumulative')}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 900, height: 280 }}>
          <AreaChart data={cumulative} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="dom-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--c-purple)" stopOpacity={0.35} />
                <stop offset="1" stopColor="var(--c-purple)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" vertical={false} />
            <XAxis dataKey="rank" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} minTickGap={24} />
            <YAxis domain={[0, 1]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => fmt.percent(v, 0)} />
            <ReferenceLine y={1 / 3} stroke="var(--c-red)" strokeDasharray="5 4" label={{ value: '33.4%', fill: 'var(--c-red)', fontSize: 11, position: 'insideBottomRight' }} />
            <ReferenceLine y={2 / 3} stroke="var(--c-yellow)" strokeDasharray="5 4" label={{ value: '66.7%', fill: 'var(--c-yellow)', fontSize: 11, position: 'insideBottomRight' }} />
            <RTooltip content={<ChartTooltip labelFormatter={(l) => t('dominancePage.topN', { n: l })} valueFormatter={(v) => fmt.percent(Number(v), 2)} />} />
            <Area type="monotone" dataKey="share" name={t('validators.col.cumulative')} stroke="var(--c-purple)" strokeWidth={2.2} fill="url(#dom-fill)" isAnimationActive={!reduced} animationDuration={450} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartPanel>
    </div>
  );
}


interface Share {
  name: string;
  value: number;
  fill: string;
}

/** The same shares as a donut or as one stacked bar; the list beside/below is the text alternative for both. */
function ShareChart({ data, format, animate, view, marks }: { data: Share[]; format: (v: number) => string; animate: boolean; view: 'donut' | 'stacked'; marks?: Array<{ at: number; label: string }> }) {
  const legend = (
    <ul className="grid shrink-0 gap-1.5 text-[12px] text-fg-2 sm:w-[190px]">
      {data.map((d) => (
        <li key={d.name} className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <i className="size-2 shrink-0 rounded-full" style={{ background: d.fill }} />
            <span className="truncate">{d.name}</span>
          </span>
          <span className="tabular-nums text-fg">{format(d.value)}</span>
        </li>
      ))}
    </ul>
  );
  if (view === 'stacked') {
    return (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="relative pb-5">
          <div className="flex h-8 overflow-hidden rounded-lg bg-card-hi">
            {data.map((d) => (
              <span key={d.name} className="h-full border-e border-[var(--c-canvas)] last:border-e-0" style={{ width: `${d.value * 100}%`, background: d.fill }} title={`${d.name} ${format(d.value)}`} />
            ))}
          </div>
          {(marks ?? []).map((m) => (
            <span key={m.at} aria-hidden className="absolute -top-1.5 bottom-3 w-px bg-fg" style={{ insetInlineStart: `${m.at * 100}%` }}>
              <span className="absolute top-full -translate-x-1/2 whitespace-nowrap pt-0.5 text-[10.5px] text-fg-3">{m.label}</span>
            </span>
          ))}
        </div>
        {legend}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col gap-2 sm:flex-row sm:items-center">
      <div className="h-[200px] min-h-0 flex-1 sm:h-full">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 220 }}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="56%" outerRadius="90%" paddingAngle={2} stroke="none" isAnimationActive={animate}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
            <RTooltip content={<ChartTooltip valueFormatter={(v) => format(Number(v))} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {legend}
    </div>
  );
}
