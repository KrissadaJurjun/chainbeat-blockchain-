import { useState } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OverviewChart } from '@/components/charts/OverviewChart';
import { DemoBadge } from '@/components/ui/Demo';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { Tip } from '@/components/ui/Tooltip';
import { useOverview } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { cn } from '@/lib/utils';
import { useChain } from '@/stores/chainStore';
import { RANGES, type Range } from '@/types/domain';

/** Dashboard centrepiece: multi-series performance chart with range, series toggles and refresh. */
export function OverviewPanel() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const [range, setRange] = useState<Range>('24H');
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const query = useOverview(range);
  const data = query.data;

  const toggle = (id: string): void =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (data && next.size < data.series.length - 1) next.add(id); // always keep one series visible
      return next;
    });

  const stale = query.isPlaceholderData;
  const visibleCount = data ? data.series.length - hidden.size : 0;

  return (
    <Panel aria-labelledby="overview-title" className="relative flex min-h-[420px] flex-col overflow-hidden p-4 sm:p-5">
      {/* ambient light leak, like the reference's top-right glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -end-28 -top-32 size-[380px] rounded-full bg-[radial-gradient(circle,rgb(72_140_210/0.26),transparent_66%)] light:opacity-40"
      />
      <PanelHeader
        id="overview-title"
        title={t('overview.title')}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {t('overview.unit')}
            <DemoBadge label={t('common.simulated')} />
          </span>
        }
        actions={
          <>
            <Segmented
              aria-label={t('chart.rangeLabel')}
              size="sm"
              value={range}
              onChange={setRange}
              options={RANGES.map((r) => ({ value: r, label: t(`chart.range.${r}`), ariaLabel: t(`chart.rangeLong.${r}`) }))}
            />
            <Tip label={t('common.refresh')}>
              <button
                type="button"
                aria-label={t('common.refresh')}
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
                className="grid size-8 place-items-center rounded-lg text-fg-2 transition-colors hover:bg-hover hover:text-fg disabled:opacity-60"
              >
                <RefreshCw className={cn('size-4', query.isFetching && 'animate-spin-slow')} aria-hidden />
              </button>
            </Tip>
          </>
        }
      />

      {/* legend / series toggles */}
      <div className="relative mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={t('chart.seriesLabel')}>
        {(data?.series ?? []).map((s) => {
          const on = !hidden.has(s.id);
          const stat = data?.stats.find((x) => x.id === s.id);
          const onlyOne = on && visibleCount <= 1;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              aria-disabled={onlyOne || undefined}
              onClick={() => toggle(s.id)}
              title={onlyOne ? t('chart.keepOne') : undefined}
              className={cn(
                'inline-flex h-7 items-center gap-2 rounded-full border px-2.5 text-[12px] font-medium transition-colors',
                on ? 'border-line-strong bg-card/60 text-fg' : 'border-line text-fg-3 line-through opacity-70 hover:opacity-100',
              )}
            >
              <i className="size-2 rounded-full" style={{ background: `var(--c-${s.color})`, opacity: on ? 1 : 0.4 }} />
              {s.symbol}
              {stat && on ? (
                <span className={cn('tabular-nums', stat.change >= 0 ? 'text-green' : 'text-red')}>{fmt.signedPercent(stat.change, 1)}</span>
              ) : null}
            </button>
          );
        })}
        {!data && query.isLoading ? <Skeleton className="h-7 w-48" /> : null}
      </div>

      {query.isError && data ? (
        <p role="alert" className="relative mt-3 flex items-center gap-2 rounded-lg border border-yellow/30 bg-yellow/10 px-3 py-2 text-[12px] text-fg-2">
          <TriangleAlert className="size-4 shrink-0 text-yellow" aria-hidden />
          {t('overview.refreshFailed')}
          <button type="button" onClick={() => void query.refetch()} className="ms-auto font-medium text-cyan hover:underline">
            {t('common.retry')}
          </button>
        </p>
      ) : null}

      <div className="relative mt-2 min-h-[260px] flex-1" aria-busy={query.isFetching}>
        {query.isLoading ? (
          <Skeleton className="absolute inset-0" />
        ) : query.isError && !data ? (
          <ErrorState onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : data && data.points.length > 0 ? (
          <div className="absolute inset-0">
            <OverviewChart data={data} hidden={hidden} emphasisId={chain.symbol} dimmed={stale} />
          </div>
        ) : (
          <EmptyState title={t('chart.emptyTitle')} description={t('chart.emptyBody')} />
        )}
      </div>
    </Panel>
  );
}
