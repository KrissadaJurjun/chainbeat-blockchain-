import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Gavel, Percent, Scale, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AXIS_LINE, AXIS_TICK, ChartTooltip, GRID_STROKE } from '@/components/charts/ChartTooltip';
import { ChartKey } from '@/components/charts/ChartKey';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { TALLY_COLORS, TallyBar } from '@/components/governance/Tally';
import { DemoBadge } from '@/components/ui/Demo';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { useGovernanceStats } from '@/hooks/useChainData';
import { useProposals } from '@/hooks/useGovernance';
import { useFormat } from '@/hooks/useFormat';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { paths } from '@/lib/paths';
import { DAY_MS } from '@/lib/utils';
import { useChain } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';
import type { ProposalStatus } from '@/types/domain';

const STATUS_COLOR: Record<ProposalStatus, string> = {
  passed: 'var(--c-green)',
  rejected: 'var(--c-red)',
  failed: 'var(--c-fg-3)',
  voting: 'var(--c-blue)',
  deposit: 'var(--c-yellow)',
};

export default function GovernancePage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const reduced = useReducedMotion();
  const stats = useGovernanceStats();
  const proposals = useProposals().data;
  const d = stats.data;

  const now = getSimNow();
  const outcomeKey = [
    { label: t('proposals.status.passed'), color: STATUS_COLOR.passed },
    { label: t('proposals.status.rejected'), color: STATUS_COLOR.rejected },
    { label: t('proposals.status.failed'), color: STATUS_COLOR.failed },
    { label: t('proposals.live'), color: STATUS_COLOR.voting },
  ];
  const trend = useMemo(
    () =>
      (d?.participation ?? []).map((p, i, all) => {
        const window = all.slice(Math.max(0, i - 4), i + 1); // five-proposal moving average
        return { ...p, avg: window.reduce((a, x) => a + x.turnout, 0) / window.length };
      }),
    [d],
  );
  const months = useMemo(() => {
    const origin = new Date(now);
    const out = Array.from({ length: 12 }, (_, i) => ({ t: Date.UTC(origin.getUTCFullYear(), origin.getUTCMonth() - (11 - i), 1), passed: 0, rejected: 0, failed: 0, live: 0 }));
    for (const p of proposals?.items ?? []) {
      const s = new Date(p.submitTime);
      const bucket = out.find((m) => m.t === Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1));
      if (!bucket) continue;
      if (p.status === 'passed' || p.status === 'rejected' || p.status === 'failed') bucket[p.status]++;
      else bucket.live++;
    }
    return out;
  }, [proposals, now]);
  const active = useMemo(() => (proposals?.items ?? []).filter((p) => p.status === 'voting').sort((a, b) => a.votingEnd - b.votingEnd), [proposals]);

  const decided = d ? d.outcomes.passed + d.outcomes.rejected + d.outcomes.failed : 0;
  const outcomes = d
    ? [
        { name: t('proposals.status.passed'), value: d.outcomes.passed, fill: STATUS_COLOR.passed },
        { name: t('proposals.status.rejected'), value: d.outcomes.rejected, fill: STATUS_COLOR.rejected },
        { name: t('proposals.status.failed'), value: d.outcomes.failed, fill: STATUS_COLOR.failed },
      ].filter((o) => o.value > 0)
    : [];

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.governance')} description={t('govPage.description', { chain: chain.name })} badge={<DemoBadge label={t('common.simulated')} />} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label={t('proposalsPage.avgTurnout')} value={d ? fmt.percent(d.avgTurnout, 1) : '–'} loading={!d} />
        <StatCard icon={Scale} label={t('govPage.quorum')} value={d ? fmt.percent(d.quorum, 1) : '–'} hint={t('govPage.quorumHint')} loading={!d} />
        <StatCard icon={Percent} label={t('proposalsPage.passRate')} value={d && decided ? fmt.percent(d.outcomes.passed / decided, 0) : '–'} hint={t('proposalsPage.recentOnly')} loading={!d} />
        <StatCard icon={Gavel} label={t('proposals.live')} value={proposals ? fmt.integer(proposals.live) : '–'} hint={proposals ? t('govPage.ofTotal', { total: fmt.integer(proposals.total) }) : undefined} loading={!proposals} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartPanel title={t('govPage.participation')} description={t('govPage.participationHint')} actions={<ChartKey items={[...outcomeKey, { label: t('govPage.movingAverage'), color: 'var(--c-fg)', shape: 'solid' }]} />} height={280} loading={stats.isLoading} error={stats.isError && !d} onRetry={() => void stats.refetch()} label={t('govPage.participation')}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 720, height: 280 }}>
            <ComposedChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" vertical={false} />
              <XAxis dataKey="id" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v: number) => `#${v}`} minTickGap={20} />
              <YAxis domain={[0, 1]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => fmt.percent(v, 0)} />
              {d ? <ReferenceLine y={d.quorum} stroke="var(--c-yellow)" strokeDasharray="5 4" label={{ value: t('govPage.quorum'), fill: 'var(--c-yellow)', fontSize: 11, position: 'insideTopRight' }} /> : null}
              <RTooltip content={<ChartTooltip labelFormatter={(l) => `#${l}`} valueFormatter={(v) => fmt.percent(Number(v), 1)} />} cursor={{ fill: 'var(--c-hover)', opacity: 0.4 }} />
              <Bar dataKey="turnout" name={t('proposals.turnout')} radius={[3, 3, 0, 0]} isAnimationActive={!reduced} animationDuration={450}>
                {(d?.participation ?? []).map((p) => (
                  <Cell key={p.id} fill={STATUS_COLOR[p.status]} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="avg" name={t('govPage.movingAverage')} stroke="var(--c-fg)" strokeWidth={2} dot={false} isAnimationActive={!reduced} animationDuration={450} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title={t('govPage.outcomes')} height={280} loading={stats.isLoading} error={stats.isError && !d} onRetry={() => void stats.refetch()} label={t('govPage.outcomes')}>
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 200 }}>
                <PieChart>
                  <Pie data={outcomes} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={3} stroke="none" isAnimationActive={!reduced}>
                    {outcomes.map((o) => (
                      <Cell key={o.name} fill={o.fill} />
                    ))}
                  </Pie>
                  <RTooltip content={<ChartTooltip valueFormatter={(v) => fmt.integer(Number(v))} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-fg-2">
              {outcomes.map((o) => (
                <li key={o.name} className="inline-flex items-center gap-1.5">
                  <i className="size-2 rounded-full" style={{ background: o.fill }} />
                  {o.name} <b className="tabular-nums text-fg">{o.value}</b>
                </li>
              ))}
            </ul>
          </div>
        </ChartPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title={t('govPage.monthly')} description={t('govPage.monthlyHint')} actions={<ChartKey items={outcomeKey} />} height={240} loading={!proposals} label={t('govPage.monthlyLabel')}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 560, height: 240 }}>
            <BarChart data={months} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" vertical={false} />
              <XAxis dataKey="t" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v: number) => fmt.date(v, { month: 'short' })} interval={0} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} />
              <RTooltip content={<ChartTooltip labelFormatter={(l) => fmt.date(Number(l), { month: 'long', year: 'numeric' })} valueFormatter={(v) => fmt.integer(Number(v))} />} cursor={{ fill: 'var(--c-hover)', opacity: 0.4 }} />
              <Bar dataKey="passed" stackId="m" name={t('proposals.status.passed')} fill={STATUS_COLOR.passed} isAnimationActive={!reduced} />
              <Bar dataKey="rejected" stackId="m" name={t('proposals.status.rejected')} fill={STATUS_COLOR.rejected} isAnimationActive={!reduced} />
              <Bar dataKey="failed" stackId="m" name={t('proposals.status.failed')} fill={STATUS_COLOR.failed} isAnimationActive={!reduced} />
              <Bar dataKey="live" stackId="m" name={t('proposals.live')} fill={STATUS_COLOR.voting} radius={[3, 3, 0, 0]} isAnimationActive={!reduced} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <Panel className="p-4">
          <PanelHeader title={t('govPage.active')} subtitle={t('govPage.activeHint')} />
          {active.length === 0 ? (
            <p className="mt-4 text-[12.5px] text-fg-3">{t('govPage.noActive')}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {active.map((p) => {
                const start = p.votingEnd - chain.votingPeriodDays * DAY_MS;
                const done = Math.min(1, Math.max(0, (now - start) / (p.votingEnd - start)));
                return (
                  <li key={p.id} className="surface-row px-3.5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={paths.proposal(p.id)} className="min-w-0 text-[13px] font-medium text-fg hover:text-cyan hover:underline">
                        <span className="tabular-nums text-fg-3">#{p.id}</span> {p.title}
                      </Link>
                      <span className="shrink-0 text-[11.5px] text-fg-3">{t('proposals.endsIn', { time: fmt.relative(p.votingEnd, now) })}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card-hi" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(done * 100)} aria-label={t('govPage.elapsed', { pct: fmt.percent(done, 0) })}>
                      <div className="h-full rounded-full bg-blue" style={{ width: `${done * 100}%` }} />
                    </div>
                    <p className="mt-1 text-[11.5px] text-fg-3">{t('govPage.elapsed', { pct: fmt.percent(done, 0) })}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="p-4">
        <h2 className="font-display text-[15px] font-semibold">{t('govPage.voteShare')}</h2>
        <p className="mb-3 mt-1 text-[12px] text-fg-3">{t('govPage.voteShareHint')}</p>
        {d ? (
          <>
            <TallyBar tally={d.voteShare} legend={false} />
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(['yes', 'no', 'abstain', 'veto'] as const).map((k) => (
                <div key={k} className="surface-row flex items-center justify-between px-3.5 py-2.5">
                  <dt className="flex items-center gap-2 text-[12.5px] text-fg-2">
                    <i className="size-2 rounded-full" style={{ background: TALLY_COLORS[k] }} />
                    {t(`vote.options.${k}`)}
                  </dt>
                  <dd className="font-display text-[16px] font-bold tabular-nums text-fg">{fmt.percent(d.voteShare[k], 1)}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </Panel>
    </div>
  );
}
