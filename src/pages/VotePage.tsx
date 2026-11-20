import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProposalStatusBadge, TallyBar } from '@/components/governance/Tally';
import { VotingPanel } from '@/components/governance/VotingPanel';
import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/Demo';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { ActivityList } from '@/components/wallet/ActivityList';
import { WalletGate } from '@/components/wallet/WalletGate';
import { useProposals } from '@/hooks/useGovernance';
import { useFormat } from '@/hooks/useFormat';
import { paths } from '@/lib/paths';
import { useChain } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';

/** Every proposal that is open for voting, each with its own (simulated) voting panel. */
export default function VotePage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const [params] = useSearchParams();
  const focus = Number(params.get('proposal'));
  const { data, isLoading, isError, refetch, isFetching } = useProposals();
  const live = (data?.items ?? []).filter((p) => p.status === 'voting').sort((a, b) => (a.id === focus ? -1 : b.id === focus ? 1 : b.id - a.id));

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.vote')} description={t('vote.description', { chain: chain.name })} badge={<DemoBadge label={t('common.simulated')} />} />
      <WalletGate>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-[260px] rounded-2xl" />
            ) : isError ? (
              <Panel>
                <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
              </Panel>
            ) : live.length === 0 ? (
              <Panel>
                <EmptyState title={t('proposals.noneLive')} description={t('vote.noneBody', { chain: chain.name })} action={<Button asChild variant="secondary"><Link to={paths.proposals}>{t('navigation.proposals')}</Link></Button>} />
              </Panel>
            ) : (
              live.map((p) => (
                <Panel key={p.id} className="space-y-4 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] text-fg-3">#{p.id}</span>
                      <ProposalStatusBadge status={p.status} />
                      <span className="ms-auto text-[11.5px] text-fg-3">{t('proposals.endsIn', { time: fmt.relative(p.votingEnd, getSimNow()) })}</span>
                    </div>
                    <h2 className="mt-2 text-[14px] font-semibold leading-snug text-fg">
                      <Link to={paths.proposal(p.id)} className="hover:text-cyan hover:underline">
                        {p.title}
                      </Link>
                    </h2>
                    <TallyBar tally={p.tally} className="mt-3" />
                  </div>
                  <VotingPanel proposal={p} />
                </Panel>
              ))
            )}
          </div>
          <Panel className="p-4">
            <h2 className="mb-1 font-display text-[15px] font-semibold">{t('wallet.activity.title')}</h2>
            <ActivityList />
          </Panel>
        </div>
      </WalletGate>
    </div>
  );
}
