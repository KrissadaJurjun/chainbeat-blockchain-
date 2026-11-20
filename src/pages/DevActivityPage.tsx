import { useMemo, useState } from 'react';
import { CalendarCheck, Flame, GitCommitHorizontal, Star, User, Users } from 'lucide-react';
import { createColumnHelper } from '@tanstack/react-table';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { AXIS_LINE, AXIS_TICK, ChartTooltip, GRID_STROKE } from '@/components/charts/ChartTooltip';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { Heatmap, HeatmapLegend } from '@/components/charts/Heatmap';
import { Sparkline } from '@/components/charts/Sparkline';
import { DataTable } from '@/components/data/DataTable';
import { DemoBadge } from '@/components/ui/Demo';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { StatCard } from '@/components/ui/StatCard';
import { useDevActivity, useRepositories } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { useChain } from '@/stores/chainStore';
import type { Repo, RepoPeriod } from '@/types/domain';

const col = createColumnHelper<Repo>();

export default function DevActivityPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const [period, setPeriod] = useState<RepoPeriod>('month');
  const activity = useDevActivity();
  const repos = useRepositories(period);
  const weeks = useMemo(() => activity.data?.weeks ?? [], [activity.data]);
  const reduced = useReducedMotion();

  // code activity derived from the same heatmap data: commits per week and per weekday
  const weekly = useMemo(() => weeks.map((w) => ({ t: w[0]?.date ?? 0, commits: w.reduce((a, d) => a + d.count, 0) })), [weeks]);
  const weekday = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    for (const w of weeks) w.forEach((d, i) => (totals[i] = (totals[i] ?? 0) + d.count));
    return totals;
  }, [weeks]);
  const repoRows = useMemo(() => repos.data ?? [], [repos.data]);
  const totalCommits = repoRows.reduce((a, r) => a + r.commits, 0);
  const totalContributors = repoRows.reduce((a, r) => a + r.contributors, 0);
  const shades = ['var(--c-cyan)', 'var(--c-blue)', 'var(--c-purple)', 'var(--c-yellow)', 'var(--c-green)', 'var(--c-red)'];

  /** Month label above the first week of each month. */
  const monthLabels = useMemo(() => {
    const labels: Array<{ col: number; text: string }> = [];
    let last = -1;
    weeks.forEach((w, i) => {
      const first = w[0];
      if (!first) return;
      const m = new Date(first.date).getUTCMonth();
      if (m !== last) {
        labels.push({ col: i, text: fmt.date(first.date, { month: 'short' }) });
        last = m;
      }
    });
    return labels;
  }, [weeks, fmt]);

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: t('repos.col.repository'),
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <p className="ltr-isolate font-mono text-[12.5px] font-semibold text-fg">{row.original.name}</p>
            <p className="text-[11.5px] text-fg-3">{row.original.description}</p>
          </div>
        ),
      }),
      col.accessor('language', { header: t('repos.col.language'), cell: (c) => <span>{c.getValue()}</span> }),
      col.accessor('contributors', { header: t('repos.contributors'), meta: { align: 'end' }, cell: (c) => <span className="inline-flex items-center gap-1 tabular-nums"><User className="size-3 text-purple" aria-hidden />{fmt.integer(c.getValue())}</span> }),
      col.accessor('stars', { header: t('repos.stars'), meta: { align: 'end' }, cell: (c) => <span className="inline-flex items-center gap-1 tabular-nums"><Star className="size-3 text-amber" aria-hidden />{fmt.integer(c.getValue())}</span> }),
      col.accessor('commits', { header: t('repos.col.commits'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums text-fg">{fmt.integer(c.getValue())}</span> }),
      col.accessor('delta', { header: t('repos.col.change'), meta: { align: 'end' }, cell: (c) => <span className={cn('tabular-nums', c.getValue() >= 0 ? 'text-green' : 'text-red')}>{fmt.signedPercent(c.getValue(), 1)}</span> }),
      col.display({ id: 'spark', header: t('repos.col.trend'), enableSorting: false, meta: { align: 'end' }, cell: ({ row }) => <div className="ms-auto w-[110px]"><Sparkline values={row.original.series} height={28} fade color="var(--c-blue)" aria-label={t('repos.sparkline', { name: row.original.name })} /></div> }),
    ],
    [t, fmt],
  );

  const dowLabel = (dow: number): string => fmt.date(Date.UTC(2024, 0, 7 + dow), { weekday: 'short', timeZone: 'UTC' });

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.devActivity')} description={t('devPage.description', { chain: chain.name })} badge={<DemoBadge label={t('common.simulated')} />} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard icon={GitCommitHorizontal} label={t('devPage.total')} value={activity.data ? fmt.integer(activity.data.total) : '–'} loading={activity.isLoading} />
        <StatCard icon={CalendarCheck} label={t('devPage.activeDays')} value={activity.data ? fmt.integer(activity.data.activeDays) : '–'} loading={activity.isLoading} />
        <StatCard icon={Flame} label={t('devPage.streak')} value={activity.data ? fmt.days(activity.data.longestStreak) : '–'} loading={activity.isLoading} />
        <StatCard icon={Star} label={t('devPage.repos')} value={repos.data ? fmt.integer(repos.data.length) : '–'} loading={repos.isLoading} />
        <StatCard icon={Users} label={t('repos.contributors')} value={repos.data ? fmt.integer(totalContributors) : '–'} hint={t('devPage.contributorsHint')} loading={repos.isLoading} />
        <StatCard icon={GitCommitHorizontal} label={t('devPage.periodCommits')} value={repos.data ? fmt.integer(totalCommits) : '–'} hint={t(`repos.periods.${period}`)} loading={repos.isLoading} />
      </div>

      <Panel className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-semibold">{t('devPage.heatmapTitle')}</h2>
          <HeatmapLegend />
        </div>
        {activity.isLoading ? (
          <Skeleton className="h-[150px]" />
        ) : activity.isError || !activity.data ? (
          <ErrorState onRetry={() => void activity.refetch()} />
        ) : (
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-[760px] gap-2">
              <div className="grid shrink-0 grid-rows-7 gap-[3px] pt-5 text-[10.5px] leading-none text-fg-3" aria-hidden>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <span key={d} className="flex items-center">
                    {d % 2 === 1 ? dowLabel(d) : ''}
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 grid h-4 text-[10.5px] text-fg-3" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }} aria-hidden>
                  {monthLabels.map((m) => (
                    <span key={`${m.col}-${m.text}`} className="whitespace-nowrap" style={{ gridColumnStart: m.col + 1 }}>
                      {m.text}
                    </span>
                  ))}
                </div>
                <Heatmap weeks={weeks} className="[&>span]:rounded-[3px]" />
              </div>
            </div>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartPanel title={t('devPage.weeklyTitle')} description={t('devPage.weeklyHint')} height={220} loading={activity.isLoading} error={activity.isError && !activity.data} onRetry={() => void activity.refetch()} label={t('devPage.weeklyTitle')}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 720, height: 220 }}>
            <BarChart data={weekly} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" vertical={false} />
              <XAxis dataKey="t" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v: number) => fmt.date(v, { month: 'short' })} minTickGap={36} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
              <RTooltip content={<ChartTooltip labelFormatter={(l) => fmt.date(Number(l), { dateStyle: 'medium' })} valueFormatter={(v) => fmt.integer(Number(v))} />} cursor={{ fill: 'var(--c-hover)', opacity: 0.4 }} />
              <Bar dataKey="commits" name={t('repos.col.commits')} fill="var(--c-cyan)" radius={[3, 3, 0, 0]} isAnimationActive={!reduced} animationDuration={450} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <Panel className="p-4">
          <PanelHeader title={t('devPage.weekdayTitle')} subtitle={t('devPage.weekdayHint')} />
          <ul className="mt-3 space-y-2">
            {weekday.map((total, d) => (
              <li key={d} className="grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-[12.5px]">
                <span className="text-fg-3">{dowLabel(d)}</span>
                <span className="h-2 overflow-hidden rounded-full bg-card-hi" aria-hidden>
                  <span className="block h-full rounded-full bg-blue" style={{ width: `${(total / Math.max(1, ...weekday)) * 100}%` }} />
                </span>
                <span className="text-end tabular-nums text-fg">{fmt.integer(total)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-semibold">{t('repos.title')}</h2>
          <Segmented aria-label={t('repos.period')} size="sm" value={period} onChange={setPeriod} options={(['week', 'month', 'quarter', 'year'] as const).map((p) => ({ value: p, label: t(`repos.periods.${p}`) }))} />
        </div>
        <DataTable data={repos.data ?? []} columns={columns} caption={t('devPage.tableCaption')} loading={repos.isLoading} error={repos.isError && !repos.data} onRetry={() => void repos.refetch()} pageSize={10} initialSort={[{ id: 'commits', desc: true }]} getRowId={(r) => r.name} minWidth={820} />
      </Panel>

      {repoRows.length > 0 && totalCommits > 0 ? (
        <Panel className="p-4">
          <PanelHeader title={t('devPage.breakdownTitle')} subtitle={t('devPage.breakdownHint', { period: t(`repos.periods.${period}`) })} />
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-card-hi" role="img" aria-label={t('devPage.breakdownTitle')}>
            {repoRows.map((r, i) => (
              <span key={r.name} className="h-full border-e border-[var(--c-canvas)] last:border-e-0" style={{ width: `${(r.commits / totalCommits) * 100}%`, background: shades[i % shades.length] }} />
            ))}
          </div>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2 xl:grid-cols-3">
            {repoRows.map((r, i) => (
              <li key={r.name} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-fg-2">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: shades[i % shades.length] }} aria-hidden />
                  <span className="ltr-isolate truncate font-mono text-[12px]">{r.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-fg">{fmt.percent(r.commits / totalCommits, 1)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
