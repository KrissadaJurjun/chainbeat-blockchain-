import { useMemo, useState } from 'react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip as RTooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { Percent, ShieldCheck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AXIS_LINE, AXIS_TICK, GRID_STROKE } from '@/components/charts/ChartTooltip';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { DemoBadge } from '@/components/ui/Demo';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Switch } from '@/components/ui/Switch';
import { useValidators } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useChain } from '@/stores/chainStore';
import type { Validator, ValidatorStatus } from '@/types/domain';

const COLORS: Record<ValidatorStatus, string> = { active: 'var(--c-cyan)', inactive: 'var(--c-fg-3)', jailed: 'var(--c-red)' };

interface Point {
  moniker: string;
  commission: number;
  uptime: number;
  power: number;
  status: ValidatorStatus;
}

/** Commission vs uptime for every validator; bubble size = voting power. */
export default function ValidatorsVizPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const reduced = useReducedMotion();
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, isError, refetch } = useValidators();

  const points = useMemo<Point[]>(
    () => (data ?? []).filter((v: Validator) => showAll || v.status === 'active').map((v) => ({ moniker: v.moniker, commission: v.commission * 100, uptime: v.uptime * 100, power: Math.max(v.votingPower * 100, 0.05), status: v.status })),
    [data, showAll],
  );
  const groups = (['active', 'inactive', 'jailed'] as const).map((s) => ({ status: s, items: points.filter((p) => p.status === s) })).filter((g) => g.items.length > 0);
  const active = (data ?? []).filter((v) => v.status === 'active');
  const avgUptime = active.length ? active.reduce((a, v) => a + v.uptime, 0) / active.length : 0;
  const zeroFee = active.filter((v) => v.commission === 0).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('navigation.validatorsViz')}
        description={t('validatorsViz.description', { chain: chain.name })}
        badge={<DemoBadge label={t('common.simulated')} />}
        actions={
          <label className="flex items-center gap-2.5 text-[12.5px] text-fg-2">
            {t('validatorsViz.showAll')}
            <Switch checked={showAll} onCheckedChange={setShowAll} aria-label={t('validatorsViz.showAll')} />
          </label>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label={t('validators.stats.active')} value={fmt.integer(active.length)} loading={isLoading} />
        <StatCard icon={ShieldCheck} label={t('validatorsViz.avgUptime')} value={fmt.percent(avgUptime, 2)} loading={isLoading} />
        <StatCard icon={Percent} label={t('validatorsViz.zeroFee')} value={fmt.integer(zeroFee)} loading={isLoading} />
      </div>
      <ChartPanel
        title={t('validatorsViz.chartTitle')}
        description={t('validatorsViz.chartHint')}
        height={420}
        loading={isLoading}
        error={isError && !data}
        onRetry={() => void refetch()}
        label={t('validatorsViz.chartTitle')}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 900, height: 420 }}>
          <ScatterChart margin={{ top: 12, right: 20, bottom: 24, left: 4 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" />
            <XAxis type="number" dataKey="commission" name={t('validators.col.commission')} unit="%" domain={[0, 22]} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} label={{ value: t('validators.col.commission'), position: 'insideBottom', offset: -12, fill: 'var(--c-fg-3)', fontSize: 11 }} />
            <YAxis type="number" dataKey="uptime" name={t('validators.col.uptime')} unit="%" domain={showAll ? [50, 100] : [96, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
            <ZAxis type="number" dataKey="power" range={[40, 520]} name={t('validators.col.power')} />
            <RTooltip
              cursor={{ strokeDasharray: '3 4', stroke: 'var(--c-fg-3)' }}
              content={({ active: on, payload }) => {
                const p = payload?.[0]?.payload as Point | undefined;
                if (!on || !p) return null;
                return (
                  <div className="glass-pop pointer-events-none rounded-xl px-3 py-2.5 text-[12px]">
                    <p className="mb-1 font-semibold text-fg">{p.moniker}</p>
                    <p className="text-fg-2">{t('validators.col.power')}: <b className="tabular-nums text-fg">{fmt.number(p.power, { maximumFractionDigits: 2 })}%</b></p>
                    <p className="text-fg-2">{t('validators.col.commission')}: <b className="tabular-nums text-fg">{fmt.number(p.commission, { maximumFractionDigits: 1 })}%</b></p>
                    <p className="text-fg-2">{t('validators.col.uptime')}: <b className="tabular-nums text-fg">{fmt.number(p.uptime, { maximumFractionDigits: 2 })}%</b></p>
                  </div>
                );
              }}
            />
            {groups.map((g) => (
              <Scatter key={g.status} name={t(`validators.status.${g.status}`)} data={g.items} fill={COLORS[g.status]} fillOpacity={0.55} stroke={COLORS[g.status]} isAnimationActive={!reduced} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </ChartPanel>
      <ul className="flex flex-wrap items-center gap-4 text-[12px] text-fg-2" aria-label={t('validatorsViz.legend')}>
        {groups.map((g) => (
          <li key={g.status} className="inline-flex items-center gap-1.5">
            <i className="size-2.5 rounded-full" style={{ background: COLORS[g.status] }} />
            {t(`validators.status.${g.status}`)} <span className="tabular-nums text-fg-3">({g.items.length})</span>
          </li>
        ))}
        <li className="text-fg-3">{t('validatorsViz.sizeHint')}</li>
      </ul>
    </div>
  );
}
