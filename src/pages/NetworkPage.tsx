import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Activity, CircleCheck, Fuel, Layers, Percent, Server, Timer, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AXIS_LINE, AXIS_TICK, ChartTooltip, GRID_STROKE } from '@/components/charts/ChartTooltip';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { Badge } from '@/components/ui/Badge';
import { DemoBadge } from '@/components/ui/Demo';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { useMetrics, useNetworkStats } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useChain } from '@/stores/chainStore';
import type { NetworkStats } from '@/types/domain';

export default function NetworkPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const reduced = useReducedMotion();
  const stats = useNetworkStats();
  const metrics = useMetrics().data;
  const d = stats.data;

  // "health" is a plain, explainable rule over the same simulated numbers (never a claim about a real network)
  const total = d ? d.txOutcome.ok + d.txOutcome.failed : 0;
  const successRate = total > 0 && d ? d.txOutcome.ok / total : undefined;
  const gasShare = d && d.gasUsage.length > 0 ? d.gasUsage.reduce((a, g) => a + g.used / g.limit, 0) / d.gasUsage.length : undefined;
  const healthy = d && metrics && successRate !== undefined ? d.uptime >= 0.998 && successRate >= 0.95 && Math.abs(metrics.blockTimeSec / chain.blockTimeSec - 1) < 0.3 : undefined;

  const formatParam = (p: NetworkStats['params'][number]): string => {
    switch (p.unit) {
      case 'percent':
        return fmt.percent(p.value, 2);
      case 'days':
        return fmt.days(p.value);
      case 'seconds':
        return fmt.seconds(p.value, 2);
      default:
        return fmt.integer(p.value);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.network')} description={t('networkPage.description', { chain: chain.name })} badge={<DemoBadge label={t('common.simulated')} />} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={healthy === false ? TriangleAlert : CircleCheck}
          label={t('networkPage.health')}
          value={healthy === undefined ? '–' : t(healthy ? 'networkPage.healthy' : 'networkPage.degraded')}
          hint={t('networkPage.healthHint')}
          loading={!d || !metrics}
        />
        <StatCard icon={Percent} label={t('networkPage.successRate')} value={successRate !== undefined ? fmt.percent(successRate, 1) : '–'} hint={d ? t('networkPage.outcomeHint', { ok: fmt.integer(d.txOutcome.ok), failed: fmt.integer(d.txOutcome.failed) }) : undefined} loading={!d} />
        <StatCard icon={Fuel} label={t('networkPage.gasUtilisation')} value={gasShare !== undefined ? fmt.percent(gasShare, 1) : '–'} hint={t('networkPage.last60')} loading={!d} />
        <StatCard icon={Layers} label={t('metrics.bondedRatio')} value={d?.bondedHistory.length ? fmt.percent(d.bondedHistory[d.bondedHistory.length - 1]!.ratio, 1) : '–'} loading={!d} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Timer} label={t('metrics.blockTime.label')} value={metrics ? fmt.seconds(metrics.blockTimeSec, 2) : '–'} loading={!metrics} />
        <StatCard icon={Layers} label={t('metrics.txPerBlock.label')} value={metrics ? fmt.decimal(metrics.txPerBlock, 2) : '–'} loading={!metrics} />
        <StatCard icon={Activity} label={t('networkPage.uptime')} value={d ? fmt.percent(d.uptime, 3) : '–'} loading={!d} />
        <StatCard icon={Server} label={t('networkPage.peers')} value={d ? fmt.integer(d.peers) : '–'} hint={d ? t('networkPage.validatorsHint', { count: d.activeValidators }) : undefined} loading={!d} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title={t('networkPage.blockTimes')} description={t('networkPage.last60')} height={240} loading={stats.isLoading} error={stats.isError && !d} onRetry={() => void stats.refetch()} label={t('networkPage.blockTimes')}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 560, height: 240 }}>
            <LineChart data={d?.blockTimes ?? []} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" vertical={false} />
              <XAxis dataKey="height" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v: number) => `…${String(v).slice(-3)}`} minTickGap={28} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => fmt.decimal(v, 1)} domain={['auto', 'auto']} />
              {metrics ? <ReferenceLine y={metrics.blockTimeSec} stroke="var(--c-fg-3)" strokeDasharray="4 4" /> : null}
              <RTooltip content={<ChartTooltip labelFormatter={(l) => `${t('common.height')} ${fmt.integer(Number(l))}`} valueFormatter={(v) => fmt.seconds(Number(v), 2)} />} />
              <Line type="monotone" dataKey="sec" name={t('metrics.blockTime.label')} stroke="var(--c-cyan)" strokeWidth={2} dot={false} isAnimationActive={!reduced} animationDuration={450} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title={t('networkPage.txPerBlock')} description={t('networkPage.last60')} height={240} loading={stats.isLoading} error={stats.isError && !d} onRetry={() => void stats.refetch()} label={t('networkPage.txPerBlock')}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 560, height: 240 }}>
            <BarChart data={d?.txPerBlock ?? []} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" vertical={false} />
              <XAxis dataKey="height" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v: number) => `…${String(v).slice(-3)}`} minTickGap={28} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
              <RTooltip content={<ChartTooltip labelFormatter={(l) => `${t('common.height')} ${fmt.integer(Number(l))}`} valueFormatter={(v) => fmt.integer(Number(v))} />} cursor={{ fill: 'var(--c-hover)', opacity: 0.4 }} />
              <Bar dataKey="tx" name={t('blocksPage.txs')} fill="var(--c-purple)" radius={[3, 3, 0, 0]} isAnimationActive={!reduced} animationDuration={450} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title={t('networkPage.gasUsage')} description={t('networkPage.gasDescription')} height={220} loading={stats.isLoading} error={stats.isError && !d} onRetry={() => void stats.refetch()} label={t('networkPage.gasUsage')}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 560, height: 220 }}>
            <AreaChart data={(d?.gasUsage ?? []).map((g) => ({ height: g.height, share: g.used / g.limit }))} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gas-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--c-yellow)" stopOpacity={0.3} />
                  <stop offset="1" stopColor="var(--c-yellow)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" vertical={false} />
              <XAxis dataKey="height" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v: number) => `…${String(v).slice(-3)}`} minTickGap={28} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} domain={[0, 'auto']} tickFormatter={(v: number) => fmt.percent(v, 1)} />
              <RTooltip content={<ChartTooltip labelFormatter={(l) => `${t('common.height')} ${fmt.integer(Number(l))}`} valueFormatter={(v) => fmt.percent(Number(v), 2)} />} />
              <Area type="monotone" dataKey="share" name={t('networkPage.gasUtilisation')} stroke="var(--c-yellow)" strokeWidth={2} fill="url(#gas-fill)" isAnimationActive={!reduced} animationDuration={450} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <Panel className="p-4">
          <PanelHeader title={t('networkPage.outcomes')} subtitle={t('networkPage.last60')} />
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-card-hi" role="img" aria-label={successRate === undefined ? t('networkPage.outcomes') : t('networkPage.outcomeLabel', { rate: fmt.percent(successRate, 1) })}>
            <span className="h-full bg-green" style={{ width: `${(successRate ?? 0) * 100}%` }} />
            <span className="h-full bg-red" style={{ width: `${(1 - (successRate ?? 1)) * 100}%` }} />
          </div>
          <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-card/40 p-3">
              <dt className="flex items-center gap-2 text-fg-3"><CircleCheck className="size-4 text-green" aria-hidden /> {t('networkPage.succeeded')}</dt>
              <dd className="mt-1 text-[18px] font-semibold tabular-nums text-fg">{d ? fmt.integer(d.txOutcome.ok) : '–'}</dd>
            </div>
            <div className="rounded-xl border border-line bg-card/40 p-3">
              <dt className="flex items-center gap-2 text-fg-3"><TriangleAlert className="size-4 text-red" aria-hidden /> {t('networkPage.failedTx')}</dt>
              <dd className="mt-1 text-[18px] font-semibold tabular-nums text-fg">{d ? fmt.integer(d.txOutcome.failed) : '–'}</dd>
            </div>
          </dl>
          <p className="mt-3 flex items-center gap-2 text-[12px] text-fg-3"><Badge tone="neutral">{t('common.simulated')}</Badge> {t('networkPage.outcomeNote')}</p>
          <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-fg-3">{t('networkPage.healthRule')}</p>
        </Panel>
      </div>

      <ChartPanel title={t('networkPage.stakingTrend')} description={t('networkPage.last30d')} height={260} loading={stats.isLoading} error={stats.isError && !d} onRetry={() => void stats.refetch()} label={t('networkPage.stakingTrend')}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1000, height: 260 }}>
          <ComposedChart data={d?.bondedHistory ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="bond-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--c-blue)" stopOpacity={0.3} />
                <stop offset="1" stopColor="var(--c-blue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v: number) => fmt.date(v, { month: 'short', day: 'numeric' })} minTickGap={36} />
            <YAxis yAxisId="ratio" tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} domain={['auto', 'auto']} tickFormatter={(v: number) => fmt.percent(v, 1)} />
            <YAxis yAxisId="apr" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} domain={['auto', 'auto']} tickFormatter={(v: number) => fmt.percent(v, 1)} />
            <RTooltip content={<ChartTooltip labelFormatter={(l) => fmt.date(Number(l), { dateStyle: 'medium' })} valueFormatter={(v) => fmt.percent(Number(v), 2)} />} />
            <Area yAxisId="ratio" type="monotone" dataKey="ratio" name={t('metrics.bondedRatio')} stroke="var(--c-blue)" strokeWidth={2} fill="url(#bond-fill)" isAnimationActive={!reduced} animationDuration={450} />
            <Line yAxisId="apr" type="monotone" dataKey="apr" name={t('metrics.stakingApr.label')} stroke="var(--c-yellow)" strokeWidth={2} dot={false} isAnimationActive={!reduced} animationDuration={450} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartPanel>

      <Panel className="p-4">
        <h2 className="mb-3 font-display text-[15px] font-semibold">{t('networkPage.parameters')}</h2>
        <dl className="grid gap-x-8 gap-y-2.5 text-[13px] sm:grid-cols-2 xl:grid-cols-4">
          {(d?.params ?? []).map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-3 border-b border-line pb-2">
              <dt className="text-fg-3">{t(`networkPage.params.${p.key}`)}</dt>
              <dd className="font-medium tabular-nums text-fg">{formatParam(p)}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
