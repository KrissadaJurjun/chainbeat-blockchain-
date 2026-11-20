import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FilePlus2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProposalStatusBadge, TALLY_COLORS, TallyBar } from '@/components/governance/Tally';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { useProposals } from '@/hooks/useGovernance';
import { useFormat } from '@/hooks/useFormat';
import { VOTE_OPTIONS } from '@/lib/governance';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import { getSimNow } from '@/stores/simStore';
import type { ProposalStatus } from '@/types/domain';

/** Original artwork for the empty state: nested hexagons around an orbit mark (echoes the reference). */
function GovernanceArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" className={className} fill="none" aria-hidden="true" focusable="false">
      <polygon points="80,8 142,44 142,116 80,152 18,116 18,44" stroke="var(--c-line-strong)" strokeWidth="2" fill="var(--c-card)" fillOpacity="0.55" />
      <polygon points="80,26 126,53 126,107 80,134 34,107 34,53" stroke="var(--c-line-strong)" strokeWidth="1.5" fill="var(--c-panel-hi)" fillOpacity="0.8" />
      <g stroke="var(--c-fg-3)" strokeWidth="2.2" strokeLinecap="round">
        <ellipse cx="80" cy="80" rx="30" ry="11" />
        <ellipse cx="80" cy="80" rx="30" ry="11" transform="rotate(60 80 80)" />
        <ellipse cx="80" cy="80" rx="30" ry="11" transform="rotate(120 80 80)" />
      </g>
      <circle cx="80" cy="80" r="5.5" fill="var(--c-fg-2)" />
    </svg>
  );
}

/** Page numbers with ellipses, e.g. 1 2 … 8 9 10 (like the reference). */
export function pageWindow(page: number, total: number): Array<number | '…'> {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, 2, total - 2, total - 1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] as number) > 1) out.push('…');
    out.push(p);
  });
  return out;
}

type Filter = 'live' | 'passed' | 'rejected' | 'all';
const FILTERS: readonly Filter[] = ['live', 'passed', 'rejected', 'all'];
const MATCH: Record<Filter, (s: ProposalStatus) => boolean> = {
  live: (s) => s === 'voting',
  passed: (s) => s === 'passed',
  rejected: (s) => s === 'rejected',
  all: () => true,
};
const DOT: Record<Filter, string> = { live: 'var(--c-blue)', passed: 'var(--c-green)', rejected: 'var(--c-red)', all: 'var(--c-purple)' };

export function ProposalsPanel() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const { data, isLoading, isError, refetch, isFetching } = useProposals();
  const [filter, setFilter] = useState<Filter>('live');
  const [page, setPage] = useState(1);

  const counts: Record<Filter, number> = useMemo(() => {
    const items = data?.items ?? [];
    return { live: data?.live ?? 0, passed: items.filter((p) => p.status === 'passed').length, rejected: items.filter((p) => p.status === 'rejected').length, all: data?.total ?? 0 };
  }, [data]);
  const list = useMemo(() => (data ? data.items.filter((p) => MATCH[filter](p.status)) : []), [data, filter]);
  const pages = list.length;
  const current = list[Math.min(page, Math.max(1, pages)) - 1];

  const pick = (f: Filter): void => {
    setFilter(f);
    setPage(1);
  };

  return (
    <Panel aria-labelledby="proposals-title" className="flex min-h-[290px] flex-col p-4">
      <PanelHeader
        id="proposals-title"
        title={t('proposals.title')}
        actions={
          <>
            <Link to={paths.createProposal} aria-label={t('navigation.createProposal')} title={t('navigation.createProposal')} className="grid size-8 place-items-center rounded-lg text-fg-2 transition-colors hover:bg-hover hover:text-fg">
              <FilePlus2 className="size-4" aria-hidden />
            </Link>
            <Link to={paths.governance} aria-label={t('proposals.viewAll')} className="grid size-8 place-items-center rounded-lg text-fg-2 transition-colors hover:bg-hover hover:text-fg">
              <ChevronRight className="size-[18px] rtl:rotate-180" aria-hidden />
            </Link>
          </>
        }
      />

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1" role="group" aria-label={t('proposals.filter')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => pick(f)}
            className={cn('inline-flex items-center gap-1.5 rounded-md text-[12px] transition-colors hover:text-fg', filter === f ? 'text-fg' : 'text-fg-3')}
          >
            <i className="size-1.5 rounded-full" style={{ background: DOT[f] }} />
            {f === 'live' ? t('proposals.live') : f === 'all' ? t('proposals.total') : t('proposals.' + f)}
            <b className="font-semibold tabular-nums text-fg">{data ? fmt.integer(counts[f]) : '–'}</b>
          </button>
        ))}
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <Skeleton className="flex-1" />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} retrying={isFetching} className="py-6" />
        ) : !current ? (
          <div className="relative flex-1 overflow-hidden rounded-xl border border-line bg-[radial-gradient(120%_90%_at_10%_100%,rgb(150_70_150/0.16),transparent_60%),linear-gradient(180deg,var(--c-card),var(--c-panel))] p-4">
            <p className="font-display text-[14px] font-semibold text-fg">{t(filter === 'live' ? 'proposals.noneLive' : 'proposals.noneMatching')}</p>
            <p className="mt-1 max-w-[24ch] text-[12px] leading-relaxed text-fg-3">{t(filter === 'live' ? 'proposals.noneLiveBody' : 'proposals.noneMatchingBody')}</p>
            <div className="relative z-10 mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => pick('all')}>
                {t('proposals.showAll')}
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to={paths.createProposal}>{t('navigation.createProposal')}</Link>
              </Button>
            </div>
            <GovernanceArt className="pointer-events-none absolute -bottom-6 -end-4 size-[150px] opacity-80" />
          </div>
        ) : (
          <article className="flex flex-1 flex-col rounded-xl border border-line bg-gradient-to-b from-card to-panel p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px] text-fg-3">#{current.id}</span>
              <ProposalStatusBadge status={current.status} />
              {current.demo ? <Badge tone="yellow">{t('common.demo')}</Badge> : null}
              <span className="ms-auto text-[11.5px] text-fg-3">{current.status === 'voting' ? t('proposals.endsIn', { time: fmt.relative(current.votingEnd, getSimNow()) }) : fmt.date(current.votingEnd)}</span>
            </div>
            <h3 className="mt-2 text-[13px] font-semibold leading-snug text-fg">
              <Link to={paths.proposal(current.id)} className="line-clamp-2 hover:text-cyan hover:underline">
                {current.title}
              </Link>
            </h3>
            <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-fg-3">{current.summary}</p>
            <div className="mt-auto pt-3">
              <TallyBar tally={current.tally} legend={false} />
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-fg-3">
                {VOTE_OPTIONS.map((o) => (
                  <li key={o} className="flex items-center gap-1.5">
                    <i className="size-1.5 shrink-0 rounded-full" style={{ background: TALLY_COLORS[o] }} aria-hidden />
                    <span className="truncate">{t('vote.options.' + o)}</span>
                    <b className="ms-auto font-semibold tabular-nums text-fg-2">{fmt.percent(current.tally[o], 0)}</b>
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-fg-3">
                <span>
                  {t('proposals.turnout')} <b className="font-semibold tabular-nums text-fg-2">{fmt.percent(current.turnout, 1)}</b>
                </span>
                <span className="flex gap-1.5">
                  <Button size="sm" variant="secondary" asChild>
                    <Link to={paths.proposal(current.id)}>{t('common.details')}</Link>
                  </Button>
                  {current.status === 'voting' ? (
                    <Button size="sm" asChild>
                      <Link to={paths.proposal(current.id) + '#vote'}>{t('proposals.vote')}</Link>
                    </Button>
                  ) : null}
                </span>
              </div>
            </div>
          </article>
        )}
      </div>

      {pages > 1 ? (
        <nav aria-label={t('common.pagination')} className="mt-3 flex items-center justify-end gap-0.5 text-[11.5px] text-fg-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="inline-flex h-6 items-center gap-0.5 rounded-md px-1.5 transition-colors hover:text-fg disabled:opacity-40">
            <ChevronLeft className="size-3 rtl:rotate-180" aria-hidden />
            {t('common.previous')}
          </button>
          {pageWindow(page, pages).map((p, i) =>
            p === '…' ? (
              <span key={'e' + i} aria-hidden className="px-1">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === page ? 'page' : undefined}
                aria-label={t('common.pageN', { n: p })}
                onClick={() => setPage(p)}
                className={cn('grid size-6 place-items-center rounded-full tabular-nums transition-colors', p === page ? 'bg-active text-fg shadow-[inset_0_0_0_1px_var(--c-active-line)]' : 'hover:text-fg')}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="inline-flex h-6 items-center gap-0.5 rounded-md px-1.5 transition-colors hover:text-fg disabled:opacity-40">
            {t('common.next')}
            <ChevronRight className="size-3 rtl:rotate-180" aria-hidden />
          </button>
        </nav>
      ) : null}
    </Panel>
  );
}
