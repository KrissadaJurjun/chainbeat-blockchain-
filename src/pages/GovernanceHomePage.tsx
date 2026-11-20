import { useMemo } from 'react';
import { CircleCheck, CircleX, FilePlus2, Gavel, Hourglass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProposalCard } from '@/components/governance/ProposalCard';
import { ProposalStatusBadge } from '@/components/governance/Tally';
import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/Demo';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { useProposals } from '@/hooks/useGovernance';
import { useFormat } from '@/hooks/useFormat';
import { paths } from '@/lib/paths';
import { useChain } from '@/stores/chainStore';

/** Governance overview: what is being voted on now, what was decided recently, and where to act. */
export default function GovernanceHomePage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const { data, isLoading, isError, refetch, isFetching } = useProposals();

  const groups = useMemo(() => {
    const items = data?.items ?? [];
    return {
      voting: items.filter((p) => p.status === 'voting'),
      deposit: items.filter((p) => p.status === 'deposit'),
      passed: items.filter((p) => p.status === 'passed'),
      rejected: items.filter((p) => p.status === 'rejected'),
      decided: items.filter((p) => p.status === 'passed' || p.status === 'rejected' || p.status === 'failed').slice(0, 8),
    };
  }, [data]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('navigation.governanceHome')}
        description={t('govPage.homeDescription', { chain: chain.name })}
        badge={<DemoBadge label={t('common.simulated')} />}
        actions={
          <>
            <Button variant="secondary" size="sm" asChild>
              <Link to={paths.proposals}>{t('govPage.allProposals')}</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to={paths.governanceAnalytics}>{t('navigation.governance')}</Link>
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link to={paths.createProposal}>
                <FilePlus2 className="size-3.5" aria-hidden /> {t('navigation.createProposal')}
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Hourglass} label={t('proposals.live')} value={data ? fmt.integer(groups.voting.length) : '–'} loading={isLoading} />
        <StatCard icon={CircleCheck} label={t('proposals.passed')} value={data ? fmt.integer(groups.passed.length) : '–'} hint={t('proposalsPage.recentOnly')} loading={isLoading} />
        <StatCard icon={CircleX} label={t('proposals.rejected')} value={data ? fmt.integer(groups.rejected.length) : '–'} hint={t('proposalsPage.recentOnly')} loading={isLoading} />
        <StatCard icon={Gavel} label={t('proposals.total')} value={data ? fmt.integer(data.total) : '–'} loading={isLoading} />
      </div>

      {isError ? (
        <Panel>
          <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
        </Panel>
      ) : (
        <>
          <section aria-labelledby="gov-voting" className="space-y-3">
            <h2 id="gov-voting" className="font-display text-[15px] font-semibold">
              {t('govPage.votingNow')}
            </h2>
            {isLoading ? (
              <Skeleton className="h-[190px] rounded-2xl" />
            ) : groups.voting.length === 0 ? (
              <Panel>
                <EmptyState title={t('proposals.noneLive')} description={t('proposals.noneLiveBody')} action={<Button asChild variant="secondary"><Link to={paths.createProposal}>{t('navigation.createProposal')}</Link></Button>} />
              </Panel>
            ) : (
              <ul className="grid gap-4 lg:grid-cols-2">
                {groups.voting.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <ProposalCard proposal={p} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {groups.deposit.length > 0 ? (
            <section aria-labelledby="gov-deposit" className="space-y-3">
              <h2 id="gov-deposit" className="font-display text-[15px] font-semibold">
                {t('govPage.depositStage')}
              </h2>
              <ul className="grid gap-4 lg:grid-cols-2">
                {groups.deposit.map((p) => (
                  <li key={p.id}>
                    <ProposalCard proposal={p} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <Panel className="p-4" aria-labelledby="gov-decided">
            <PanelHeader id="gov-decided" title={t('govPage.recentlyDecided')} actions={<Link to={paths.proposals + '?status=passed'} className="text-[12px] text-cyan hover:underline">{t('common.viewAll')}</Link>} />
            <ul className="mt-3 divide-y divide-line">
              {groups.decided.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[12.5px]">
                  <span className="font-mono text-fg-3">#{p.id}</span>
                  <ProposalStatusBadge status={p.status} />
                  <Link to={paths.proposal(p.id)} className="min-w-0 flex-1 truncate text-fg hover:text-cyan hover:underline">
                    {p.title}
                  </Link>
                  <span className="whitespace-nowrap tabular-nums text-fg-3">{fmt.date(p.votingEnd)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
