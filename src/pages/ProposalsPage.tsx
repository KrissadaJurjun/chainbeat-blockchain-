import { useMemo, useState } from 'react';
import { FilePlus2, Gavel, Hourglass, ThumbsUp, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProposalCard } from '@/components/governance/ProposalCard';
import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/Demo';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { StatCard } from '@/components/ui/StatCard';
import { useProposals } from '@/hooks/useGovernance';
import { useFormat } from '@/hooks/useFormat';
import { paths } from '@/lib/paths';
import { useChain } from '@/stores/chainStore';
import type { Proposal, ProposalStatus } from '@/types/domain';

type Filter = 'all' | ProposalStatus;
const FILTERS: Filter[] = ['all', 'voting', 'deposit', 'passed', 'rejected', 'failed'];
const PAGE = 12;

export default function ProposalsPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const [params, setParams] = useSearchParams();
  const filterParam = params.get('status') as Filter | null;
  const filter: Filter = filterParam && FILTERS.includes(filterParam) ? filterParam : 'all';
  const q = params.get('q') ?? '';
  const { data, isLoading, isError, refetch, isFetching } = useProposals();
  const [visible, setVisible] = useState(PAGE);

  const setParam = (key: string, value: string): void => {
    const next = new URLSearchParams(params);
    if (value && value !== 'all') next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setVisible(PAGE);
  };

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const number = needle.replace(/^#/, '');
    // a proposal matches on its number, title, description, category or status (translated and as stored), ignoring case
    const matches = (p: Proposal): boolean =>
      !needle ||
      (/^\d+$/.test(number) && String(p.id).startsWith(number)) ||
      [p.title, p.description, p.type, p.status, t('proposalsPage.types.' + p.type), t('proposals.status.' + p.status)].some((field) => field.toLowerCase().includes(needle));
    return (data?.items ?? []).filter((p) => (filter === 'all' || p.status === filter) && matches(p));
  }, [data, filter, q, t]);
  const stats = useMemo(() => {
    const all = data?.items ?? [];
    const decided = all.filter((p) => p.status === 'passed' || p.status === 'rejected' || p.status === 'failed');
    return {
      passRate: decided.length ? decided.filter((p) => p.status === 'passed').length / decided.length : 0,
      turnout: all.length ? all.reduce((a, p) => a + p.turnout, 0) / all.length : 0,
    };
  }, [data]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('navigation.proposals')}
        description={t('proposalsPage.description', { chain: chain.name })}
        badge={<DemoBadge label={t('common.simulated')} />}
        actions={
          <Button variant="primary" size="sm" className="2xl:h-[34px] 2xl:px-3.5 2xl:text-[13px]" asChild>
            <Link to={paths.createProposal}>
              <FilePlus2 className="size-3.5" aria-hidden /> {t('navigation.createProposal')}
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:gap-[15px]">
        <StatCard icon={Hourglass} label={t('proposals.live')} value={data ? fmt.integer(data.live) : '–'} loading={isLoading} />
        <StatCard icon={Gavel} label={t('proposals.total')} value={data ? fmt.integer(data.total) : '–'} loading={isLoading} />
        <StatCard icon={ThumbsUp} label={t('proposalsPage.passRate')} value={fmt.percent(stats.passRate, 0)} hint={t('proposalsPage.recentOnly')} loading={isLoading} />
        <StatCard icon={Users} label={t('proposalsPage.avgTurnout')} value={fmt.percent(stats.turnout, 1)} loading={isLoading} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented aria-label={t('proposals.filter')} value={filter} onChange={(v) => setParam('status', v)} options={FILTERS.map((f) => ({ value: f, label: f === 'all' ? t('common.all') : t('proposals.status.' + f) }))} />
        <Input type="search" value={q} onChange={(e) => setParam('q', e.target.value)} placeholder={t('proposalsPage.searchPlaceholder')} aria-label={t('proposalsPage.searchPlaceholder')} className="max-w-[280px] flex-1 2xl:h-[38px] 2xl:max-w-[296px]" />
      </div>
      {isError ? (
        <Panel>
          <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
        </Panel>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[190px] rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Panel>
          {/* "No live proposals" only fits the Voting filter on its own; a search or another filter simply matched nothing */}
          {filter === 'voting' && !q.trim() ? (
            <EmptyState title={t('proposals.noneLive')} description={t('proposals.noneLiveBody')} />
          ) : (
            <EmptyState title={t('proposalsPage.noMatches')} />
          )}
        </Panel>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:gap-[19px]">
            {items.slice(0, visible).map((p) => (
              <li key={p.id}>
                <ProposalCard proposal={p} />
              </li>
            ))}
          </ul>
          <p className="text-center text-[12px] text-fg-3" aria-live="polite">
            {t('common.showing', { from: 1, to: Math.min(visible, items.length), total: items.length })}
          </p>
          {visible < items.length ? (
            <div className="flex justify-center">
              <Button variant="secondary" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
                {t('common.showMore', { count: Math.min(PAGE, items.length - visible) })}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
