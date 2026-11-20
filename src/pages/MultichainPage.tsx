import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Boxes, Globe, Layers, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChainGem } from '@/components/brand/Logo';
import { AXIS_TICK, ChartTooltip, GRID_STROKE } from '@/components/charts/ChartTooltip';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { Sparkline } from '@/components/charts/Sparkline';
import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/Demo';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { useMultichain } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { isSelectableChain } from '@/services/chain/registry';
import { useChainStore } from '@/stores/chainStore';
import { toast } from '@/stores/toastStore';

export default function MultichainPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const setChain = useChainStore((s) => s.setChain);
  const { data, isLoading, isError, refetch } = useMultichain();

  const totalTvl = (data ?? []).reduce((a, r) => a + r.tvlUsd, 0);
  const totalValidators = (data ?? []).reduce((a, r) => a + r.validators, 0);
  const totalTx = (data ?? []).reduce((a, r) => a + r.tx24h, 0);
  const tvlData = [...(data ?? [])].sort((a, b) => b.tvlUsd - a.tvlUsd).map((r) => ({ name: r.name, tvl: r.tvlUsd, color: r.gradient[0] }));

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.multichain')} description={t('multichainPage.description')} badge={<DemoBadge label={t('common.simulated')} />} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Globe} label={t('multichainPage.chains')} value={data ? fmt.integer(data.length) : '–'} loading={isLoading} />
        <StatCard icon={Layers} label={t('multichainPage.tvl')} value={data ? fmt.usdCompact(totalTvl) : '–'} loading={isLoading} />
        <StatCard icon={Users} label={t('multichainPage.validators')} value={data ? fmt.integer(totalValidators) : '–'} loading={isLoading} />
        <StatCard icon={Boxes} label={t('multichainPage.tx24h')} value={data ? fmt.compact(totalTx, 1) : '–'} loading={isLoading} />
      </div>

      {isError ? (
        <Panel>
          <ErrorState onRetry={() => void refetch()} />
        </Panel>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading || !data
            ? Array.from({ length: 8 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-[224px] rounded-2xl" />
                </li>
              ))
            : data.map((r) => {
                const selectable = isSelectableChain(r.id);
                return (
                  <li key={r.id}>
                    <Panel className="flex h-full flex-col p-4">
                      <div className="flex items-center gap-2.5">
                        <ChainGem gradient={r.gradient} className="size-6" />
                        <h2 className="min-w-0 flex-1 truncate font-display text-[14px] font-semibold text-fg">{r.name}</h2>
                        <span className="text-[11.5px] font-medium text-fg-3">{r.symbol}</span>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <span>
                          <span className="block font-display text-[19px] font-bold tabular-nums text-fg">{fmt.currency(r.priceUsd, 'USD', { maximumFractionDigits: r.priceUsd < 1 ? 4 : 2 })}</span>
                          <span className={cn('text-[12px] font-medium tabular-nums', r.change7d >= 0 ? 'text-green' : 'text-red')}>{fmt.signedPercent(r.change7d, 2)} · 7D</span>
                        </span>
                        <div className="w-[96px]">
                          <Sparkline values={r.spark} height={36} area color={r.change7d >= 0 ? 'var(--c-green)' : 'var(--c-red)'} />
                        </div>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[11.5px]">
                        {[
                          [t('multichainPage.height'), fmt.compact(r.height, 2)],
                          [t('multichainPage.validators'), fmt.integer(r.validators)],
                          [t('metrics.stakingApr.label'), fmt.percent(r.stakingApr, 1)],
                          [t('metrics.bondedRatio'), fmt.percent(r.bondedRatio, 1)],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-fg-3">{k}</dt>
                            <dd className="font-medium tabular-nums text-fg">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-auto pt-4">
                        {selectable ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            onClick={() => {
                              setChain(r.id);
                              toast.success(t('multichainPage.switched', { name: r.name }));
                              navigate('/');
                            }}
                          >
                            {t('multichainPage.open')}
                          </Button>
                        ) : (
                          <p className="text-center text-[11px] text-fg-3">{t('multichainPage.registryOnly')}</p>
                        )}
                      </div>
                    </Panel>
                  </li>
                );
              })}
        </ul>
      )}

      <ChartPanel title={t('multichainPage.tvlByChain')} description={t('multichainPage.tvlHint')} height={300} loading={isLoading} error={isError && !data} onRetry={() => void refetch()} label={t('multichainPage.tvlByChain')}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 800, height: 300 }}>
          <BarChart data={tvlData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmt.usdCompact(v)} />
            <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fill: 'var(--c-fg-2)' }} axisLine={false} tickLine={false} width={86} />
            <RTooltip content={<ChartTooltip valueFormatter={(v) => fmt.usdCompact(Number(v))} />} cursor={{ fill: 'var(--c-hover)', opacity: 0.4 }} />
            <Bar dataKey="tvl" name={t('multichainPage.tvl')} radius={[0, 4, 4, 0]} isAnimationActive={!reduced} animationDuration={450}>
              {tvlData.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <Panel className="p-4">
        <PanelHeader title={t('multichainPage.explainTitle')} subtitle={t('multichainPage.explainHint')} />
        <dl className="mt-3 grid gap-x-8 gap-y-3 text-[12.5px] md:grid-cols-2">
          {(
            [
              ['tvl', t('multichainPage.tvl')],
              ['height', t('multichainPage.height')],
              ['validators', t('multichainPage.validators')],
              ['apr', t('metrics.stakingApr.label')],
              ['bonded', t('metrics.bondedRatio')],
              ['tx24h', t('multichainPage.tx24h')],
            ] as const
          ).map(([key, term]) => (
            <div key={key}>
              <dt className="font-medium text-fg">{term}</dt>
              <dd className="mt-0.5 leading-relaxed text-fg-3">{t(`multichainPage.explain.${key}`)}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
