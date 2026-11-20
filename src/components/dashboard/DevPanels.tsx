import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Star, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heatmap, HeatmapLegend } from '@/components/charts/Heatmap';
import { SparklineTip } from '@/components/charts/SparklineTip';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { DemoNotice } from '@/components/ui/Demo';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { useDevActivity, useRepositories } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import type { Formatter } from '@/lib/format';
import { paths } from '@/lib/paths';
import { DAY_MS } from '@/lib/utils';
import { getSimNow } from '@/stores/simStore';
import type { Repo, RepoPeriod } from '@/types/domain';

type HeatRange = 'month' | 'quarter' | 'year';
const HEAT_WEEKS: Record<HeatRange, number> = { month: 5, quarter: 13, year: 53 };
const REPO_PERIODS: readonly RepoPeriod[] = ['week', 'month', 'quarter', 'year'];

/** Compact developer-activity heat map (weekdays only) with a range switch, linking to the full analytics page. */
export function DevActivityPanel() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [range, setRange] = useState<HeatRange>('year');
  const { data, isLoading, isError, refetch, isFetching } = useDevActivity();
  const weeks = data ? data.weeks.slice(-HEAT_WEEKS[range]) : [];
  const total = weeks.flat().reduce((a, d) => a + d.count, 0);

  return (
    <Panel aria-labelledby="dev-title" className="flex flex-col p-4">
      <PanelHeader
        id="dev-title"
        title={t('dev.title')}
        subtitle={data ? t('dev.summary', { total: fmt.integer(total) }) : undefined}
        actions={
          <>
            <Select
              variant="ghost"
              aria-label={t('dev.range')}
              value={range}
              onValueChange={(v) => setRange(v as HeatRange)}
              options={(['month', 'quarter', 'year'] as const).map((r) => ({ value: r, label: t('dev.ranges.' + r) }))}
            />
            <Link to={paths.developers} aria-label={t('dev.viewFull')} className="grid size-8 place-items-center rounded-lg text-fg-2 transition-colors hover:bg-hover hover:text-fg">
              <ChevronRight className="size-[18px] rtl:rotate-180" aria-hidden />
            </Link>
          </>
        }
      />
      <div className="mt-3">
        {isLoading ? (
          <Skeleton className="h-[88px]" />
        ) : isError || !data ? (
          <ErrorState onRetry={() => void refetch()} retrying={isFetching} className="py-4" />
        ) : (
          <>
            <Heatmap weeks={data.weeks} limitWeeks={HEAT_WEEKS[range]} weekdaysOnly className="[&>span]:aspect-auto [&>span]:min-h-[12px]" />
            <HeatmapLegend className="mt-2 justify-end" />
          </>
        )}
      </div>
    </Panel>
  );
}

/** Label for point `i` of a repository's activity series (a weekday, a day span, a week or a month). */
function pointLabel(period: RepoPeriod, i: number, count: number, now: number, fmt: Formatter): string {
  const back = count - 1 - i;
  if (period === 'week') return fmt.date(now - back * DAY_MS, { weekday: 'short' });
  if (period === 'month') return fmt.date(now - back * 3 * DAY_MS, { month: 'short', day: 'numeric' });
  if (period === 'quarter') return fmt.date(now - back * 7 * DAY_MS, { month: 'short', day: 'numeric' });
  return fmt.date(now - back * 30 * DAY_MS, { month: 'short', year: '2-digit' });
}

function RepoDialog({ repo, period, onClose }: { repo: Repo | null; period: RepoPeriod; onClose: () => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const now = getSimNow();
  return (
    <Dialog open={repo !== null} onOpenChange={(open) => !open && onClose()}>
      {repo ? (
        <DialogContent title={repo.name} description={repo.description} size="md">
          <div className="space-y-4">
            <DemoNotice>{t('repos.demoNote')}</DemoNotice>
            <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                [t('repos.col.language'), repo.language],
                [t('repos.contributors'), fmt.integer(repo.contributors)],
                [t('repos.stars'), fmt.integer(repo.stars)],
                [t('repos.col.commits') + ' · ' + t('repos.periods.' + period), fmt.integer(repo.commits)],
              ].map(([k, v]) => (
                <div key={k} className="metric-card px-3 py-2.5">
                  <dt className="truncate text-[11px] text-fg-3">{k}</dt>
                  <dd className="mt-0.5 truncate font-display text-[15px] font-bold tabular-nums text-fg">{v}</dd>
                </div>
              ))}
            </dl>
            <section aria-labelledby="repo-history">
              <h3 id="repo-history" className="mb-2 text-[13px] font-semibold text-fg">
                {t('repos.history')} <span className="font-normal text-fg-3">· {t('repos.vsPrevious', { change: fmt.signedPercent(repo.delta, 1) })}</span>
              </h3>
              <SparklineTip
                values={repo.series}
                labels={repo.series.map((_, i) => pointLabel(period, i, repo.series.length, now, fmt))}
                format={(v) => t('repos.commitsCount', { count: fmt.integer(v) })}
                height={120}
                area
                color="var(--c-cyan)"
                aria-label={t('repos.sparkline', { name: repo.name })}
              />
            </section>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/** Active repositories with period switch, sparklines with tooltips, growth arrows and a detail dialog. */
export function ReposPanel() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [period, setPeriod] = useState<RepoPeriod>('year');
  const [selected, setSelected] = useState<Repo | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = useRepositories(period);
  const repos = (data ?? []).slice(0, 2);
  const now = getSimNow();

  return (
    <Panel aria-labelledby="repos-title" className="flex flex-col p-4">
      <PanelHeader
        id="repos-title"
        title={t('repos.title')}
        actions={
          <Select
            variant="ghost"
            aria-label={t('repos.period')}
            value={period}
            onValueChange={(v) => setPeriod(v as RepoPeriod)}
            options={REPO_PERIODS.map((p) => ({ value: p, label: t('repos.periods.' + p) }))}
          />
        }
      />
      <ul className="mt-3 space-y-2">
        {isLoading ? (
          <>
            <li>
              <Skeleton className="h-[58px] rounded-xl" />
            </li>
            <li>
              <Skeleton className="h-[58px] rounded-xl" />
            </li>
          </>
        ) : isError ? (
          <li>
            <ErrorState onRetry={() => void refetch()} retrying={isFetching} className="py-4" />
          </li>
        ) : repos.length === 0 ? (
          <li>
            <EmptyState title={t('repos.emptyTitle')} description={t('repos.emptyBody')} className="py-6" />
          </li>
        ) : (
          repos.map((r, i) => {
            const up = r.delta >= 0;
            return (
              <li key={r.name} className="surface-row grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  aria-haspopup="dialog"
                  className="min-w-0 rounded-md text-start outline-none focus-visible:ring-2 focus-visible:ring-cyan/50"
                >
                  <span className="block truncate text-[12.5px] font-semibold text-fg hover:text-cyan">{r.name}</span>
                  <span className="mt-1 flex items-center gap-2.5 text-[11px] text-fg-3">
                    <span className="inline-flex items-center gap-1" title={t('repos.contributors')}>
                      <User className="size-3 text-purple" aria-hidden />
                      <span className="sr-only">{t('repos.contributors')}</span>
                      <span className="tabular-nums">{fmt.integer(r.contributors)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1" title={t('repos.stars')}>
                      <Star className="size-3 text-amber" aria-hidden />
                      <span className="sr-only">{t('repos.stars')}</span>
                      <span className="tabular-nums">{fmt.integer(r.stars)}</span>
                    </span>
                  </span>
                </button>
                <SparklineTip
                  values={r.series}
                  labels={r.series.map((_, k) => pointLabel(period, k, r.series.length, now, fmt))}
                  format={(v) => t('repos.commitsCount', { count: fmt.integer(v) })}
                  height={30}
                  fade
                  color={i === 0 ? 'var(--c-blue)' : 'var(--c-yellow)'}
                  aria-label={t('repos.sparkline', { name: r.name })}
                />
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums text-fg" title={t('repos.vsPrevious', { change: fmt.signedPercent(r.delta, 1) })}>
                  {up ? <ArrowUp className="size-3.5 text-green" aria-hidden /> : <ArrowDown className="size-3.5 text-red" aria-hidden />}
                  <span className="sr-only">{up ? t('repos.up') : t('repos.down')}</span>
                  {fmt.integer(r.commits)}
                </span>
              </li>
            );
          })
        )}
      </ul>
      <p className="mt-2 text-[11px] text-fg-3">{t('repos.caption')}</p>
      <RepoDialog repo={selected} period={period} onClose={() => setSelected(null)} />
    </Panel>
  );
}
