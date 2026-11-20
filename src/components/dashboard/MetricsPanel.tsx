import { useState } from 'react';
import { ArrowDown, ArrowUp, Download, Ellipsis, ExternalLink, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkline } from '@/components/charts/Sparkline';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { DemoBadge } from '@/components/ui/Demo';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/Menu';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { useMetricHistory, useMetrics } from '@/hooks/useChainData';
import { useFitText } from '@/hooks/useFitText';
import { useFormat } from '@/hooks/useFormat';
import { downloadText, toCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { useChain } from '@/stores/chainStore';
import { toast } from '@/stores/toastStore';
import type { ChainMetrics, MetricKey } from '@/types/domain';
import { METRIC_DEFS, getMetricDef, type MetricDef } from './metrics';

/** A small arrow badge on the icon tile's corner: direction of the 24 h change (full figure is in the tooltip / dialog). */
function TrendBadge({ def, trend }: { def: MetricDef; trend: number | undefined }) {
  if (trend === undefined || trend === 0) return null;
  const up = trend > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  const tone = def.tone === 'signed' ? (up ? 'bg-green' : 'bg-red') : 'bg-fg-3';
  return (
    <span aria-hidden className={cn('absolute -end-1 -top-1 grid size-[15px] place-items-center rounded-full border-2 border-[var(--c-card-hi)] text-[var(--c-canvas)]', tone)}>
      <Icon className="size-[9px]" strokeWidth={3.4} />
    </span>
  );
}

function MetricCard({ def, metrics, onOpen }: { def: MetricDef; metrics: ChainMetrics; onOpen: (key: MetricKey) => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const Icon = def.icon;
  const label = t(`metrics.${def.key}.label`);
  const value = def.value(metrics, fmt);
  const valueRef = useFitText<HTMLSpanElement>(value, 15, 11);
  const trend = metrics.trend24h[def.key];
  const trendText =
    trend === undefined ? '' : def.key === 'blockHeight' ? `+${fmt.integer(trend)} ${t('metrics.blocks')}` : fmt.signedPercent(trend, 2);
  return (
    <button
      type="button"
      onClick={() => onOpen(def.key)}
      title={trendText ? `${t('metrics.change24h')}: ${trendText}` : undefined}
      aria-haspopup="dialog"
      className="metric-card group relative flex h-full min-h-[58px] w-full min-w-0 items-center gap-2 px-2.5 py-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 @max-[151px]:flex-col @max-[151px]:items-start @max-[151px]:justify-center @max-[151px]:gap-1.5 @max-[151px]:py-2.5"
    >
      <span className="icon-tile relative size-[30px] @max-[151px]:size-[28px]">
        <Icon className="size-[15px]" aria-hidden />
        <TrendBadge def={def} trend={trend} />
      </span>
      <span className="min-w-0 flex-1 @max-[151px]:w-full @max-[151px]:flex-none">
        {/* Fixed-height line so the value can shrink to fit (long figures in some languages) without moving the layout. */}
        <span ref={valueRef} data-metric-value className="block h-[19px] truncate font-display text-[15px] font-bold leading-[19px] tabular-nums text-fg">
          {value}
        </span>
        <span data-metric-label className="mt-0.5 line-clamp-2 break-words text-[11px] leading-[14px] text-fg-3">
          {label}
        </span>
        {/* The accessible name is the visible text (value, label) plus the 24 h change, so it always contains what sighted users read. */}
        {trendText ? <span className="sr-only">{`, ${t('metrics.change24h')}: ${trendText}`}</span> : null}
      </span>
    </button>
  );
}

function MetricDialogBody({ metricKey, metrics }: { metricKey: MetricKey; metrics: ChainMetrics }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const navigate = useNavigate();
  const def = getMetricDef(metricKey);
  const history = useMetricHistory(metricKey);
  const trend = metrics.trend24h[metricKey];
  const formulaKey = `metrics.${metricKey}.formula`;
  const hasFormula = t(formulaKey, { defaultValue: '' }) !== '';
  const rows = [
    ...(def.details?.(metrics, fmt) ?? []),
    ...(trend !== undefined
      ? [{ labelKey: 'metrics.change24h', value: metricKey === 'blockHeight' ? `+${fmt.integer(trend)} ${t('metrics.blocks')}` : fmt.signedPercent(trend, 3) }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <p className="font-display text-[28px] font-bold leading-none tabular-nums text-fg">{def.value(metrics, fmt)}</p>
      <p className="text-[13px] leading-relaxed text-fg-2">{t(`metrics.${metricKey}.description`)}</p>
      {hasFormula ? (
        <p className="rounded-lg border border-line bg-card/50 px-3 py-2 font-mono text-[12px] text-fg-2" dir="ltr">
          {t(formulaKey)}
        </p>
      ) : null}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">{t('metrics.last24h')}</p>
        {history.isLoading ? <Skeleton className="h-14" /> : <Sparkline values={(history.data ?? []).map((p) => p.v)} height={56} area color="var(--c-cyan)" aria-label={t('metrics.sparklineLabel')} />}
      </div>
      {rows.length > 0 ? (
        <dl className="divide-y divide-line rounded-xl border border-line bg-card/40 text-[12.5px]">
          {rows.map((r) => (
            <div key={r.labelKey} className="flex items-center justify-between gap-4 px-3 py-2">
              <dt className="text-fg-3">{t(r.labelKey)}</dt>
              <dd className="ltr-isolate font-medium tabular-nums text-fg">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <DemoBadge label={t('common.simulated')} />
        <Button size="sm" variant="secondary" onClick={() => navigate('/analytics/network')}>
          {t('metrics.openAnalytics')}
          <ExternalLink className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** "On-chain Metrics": ten coherent network statistics, each opening an explanation. */
export function MetricsPanel() {
  const { t } = useTranslation();
  const chain = useChain();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isFetching } = useMetrics();
  const [selected, setSelected] = useState<MetricKey | null>(null);

  const exportCsv = (): void => {
    if (!data) return;
    const rows = [[t('metrics.csvMetric'), t('metrics.csvValue'), t('metrics.csvUnit'), t('metrics.csvChange24h')], ...METRIC_DEFS.map((d) => {
      const raw = d.raw(data);
      return [t(`metrics.${d.key}.label`), raw.value, raw.unit, data.trend24h[d.key] ?? ''];
    })];
    downloadText(`chainbeat-metrics-${chain.id}.csv`, toCsv(rows));
    toast.success(t('metrics.exported'));
  };

  return (
    <Panel aria-labelledby="metrics-title" className="flex flex-col p-4 xl:min-h-[420px]">
      <PanelHeader
        id="metrics-title"
        title={t('metrics.title')}
        subtitle={<span className="inline-flex items-center gap-2">{chain.name} <DemoBadge label={t('common.simulated')} /></span>}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('common.options')}
              className="grid size-8 place-items-center rounded-lg text-fg-2 outline-none transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-cyan/40 data-[state=open]:bg-hover"
            >
              <Ellipsis className="size-[18px]" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => void refetch()}>
                <RefreshCw className="size-4 text-fg-3" aria-hidden /> {t('common.refresh')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportCsv} disabled={!data}>
                <Download className="size-4 text-fg-3" aria-hidden /> {t('metrics.exportCsv')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/analytics/network')}>
                <ExternalLink className="size-4 text-fg-3" aria-hidden /> {t('metrics.openAnalytics')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {isError && !data ? (
        <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
      ) : (
        <ul
          className="mt-4 grid flex-1 grid-cols-1 content-start gap-2.5 min-[380px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-2 xl:grid-rows-5"
          aria-busy={isLoading}
        >
          {isLoading || !data
            ? Array.from({ length: 10 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-[58px] rounded-xl" />
                </li>
              ))
            : METRIC_DEFS.map((def) => (
                <li key={def.key} className="@container min-w-0">
                  <MetricCard def={def} metrics={data} onOpen={setSelected} />
                </li>
              ))}
        </ul>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && data ? (
          <DialogContent title={t(`metrics.${selected}.label`)} description={`${chain.name} · ${t('common.simulated')}`} size="sm">
            <MetricDialogBody metricKey={selected} metrics={data} />
          </DialogContent>
        ) : null}
      </Dialog>
    </Panel>
  );
}
