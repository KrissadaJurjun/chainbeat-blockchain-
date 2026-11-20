import type { ReactNode } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AddressLink } from '@/components/explorer/AddressLink';
import { ProposalStatusBadge, TALLY_COLORS, TallyBar } from '@/components/governance/Tally';
import { VotingPanel } from '@/components/governance/VotingPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CopyButton, copyText } from '@/components/ui/Copy';
import { DemoBadge } from '@/components/ui/Demo';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { useProposalDetail } from '@/hooks/useGovernance';
import { useFormat } from '@/hooks/useFormat';
import { VOTE_OPTIONS, projectedOutcome, tallyTokens } from '@/lib/governance';
import { paths } from '@/lib/paths';
import { DAY_MS, cn } from '@/lib/utils';
import { useChain } from '@/stores/chainStore';
import { toast } from '@/stores/toastStore';
import type { Proposal, ProposalDetail } from '@/types/domain';

/** When the proposal was submitted, when voting opened and closes, and the result once it is decided. */
function HistoryPanel({ proposal: p }: { proposal: Proposal }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const decided = p.status === 'passed' || p.status === 'rejected' || p.status === 'failed';
  const steps: Array<{ key: string; label: string; time: number; value?: ReactNode }> = [{ key: 'submitted', label: t('proposalsPage.submitted'), time: p.submitTime }];
  if (p.status !== 'deposit') steps.push({ key: 'start', label: t('proposalsPage.votingStart'), time: p.submitTime }, { key: 'end', label: t('proposalsPage.votingEnd'), time: p.votingEnd });
  if (decided) steps.push({ key: 'result', label: t('proposalsPage.historyResult'), time: p.votingEnd, value: <ProposalStatusBadge status={p.status} /> });
  return (
    <Panel className="p-4" aria-labelledby="history-title">
      <h2 id="history-title" className="mb-3 font-display text-[15px] font-semibold">
        {t('proposalsPage.history')}
      </h2>
      <ol className="space-y-3 border-s border-line ps-4">
        {steps.map((s, i) => (
          <li key={s.key} className="relative text-[12.5px]">
            <span aria-hidden className={cn('absolute -start-[21px] top-1.5 size-2.5 rounded-full border-2 border-panel', i === steps.length - 1 ? 'bg-cyan' : 'bg-fg-3')} />
            <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
              {s.label} {s.value}
            </p>
            <p className="text-fg-3">{fmt.dateTime(s.time, { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function TallyPanel({ detail }: { detail: ProposalDetail }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const { proposal: p } = detail;
  const tokens = tallyTokens(p, detail.bondedTokens);
  const open = p.status === 'voting' || p.status === 'deposit';
  const outcome = projectedOutcome(p);
  return (
    <Panel className="space-y-4 p-4" aria-labelledby="tally-title">
      <h2 id="tally-title" className="font-display text-[15px] font-semibold">
        {t('proposalsPage.tally')}
      </h2>
      <TallyBar tally={p.tally} legend={false} />
      <dl className="divide-y divide-line rounded-xl border border-line bg-card/40 text-[12.5px]">
        {VOTE_OPTIONS.map((k) => (
          <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
            <dt className="flex items-center gap-2 text-fg-3">
              <i className="size-2 rounded-full" style={{ background: TALLY_COLORS[k] }} aria-hidden />
              {t('vote.options.' + k)}
            </dt>
            <dd className="text-end font-medium tabular-nums text-fg">
              {fmt.tokenCompact(tokens[k], chain.symbol)} <span className="ms-1 text-fg-3">{fmt.percent(p.tally[k], 2)}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[12px]">
          <span className="text-fg-3">{t('proposals.turnout')}</span>
          <span className="font-medium tabular-nums text-fg">{fmt.percent(p.turnout, 2)}</span>
        </div>
        <div className="relative h-2 rounded-full bg-line" role="img" aria-label={t('proposalsPage.turnoutVsQuorum', { turnout: fmt.percent(p.turnout, 1), quorum: fmt.percent(detail.quorum, 1) })}>
          <span className="block h-full rounded-full bg-blue" style={{ width: Math.min(100, p.turnout * 100) + '%' }} />
          <span className="absolute inset-y-[-3px] w-0.5 bg-fg-2" style={{ insetInlineStart: detail.quorum * 100 + '%' }} aria-hidden />
        </div>
        <p className="mt-1.5 text-[11.5px] text-fg-3">
          {t('proposalsPage.quorumNote', { quorum: fmt.percent(detail.quorum, 1), threshold: fmt.percent(detail.threshold, 0), veto: fmt.percent(detail.vetoThreshold, 1) })}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <span className="text-fg-3">
          {t('proposalsPage.voters')}: <b className="tabular-nums text-fg-2">{fmt.integer(detail.voters)}</b>
        </span>
        {open ? <Badge tone={outcome === 'passing' ? 'green' : outcome === 'noQuorum' ? 'yellow' : 'red'}>{t('proposalsPage.outcome.' + outcome)}</Badge> : null}
      </div>
    </Panel>
  );
}

export default function ProposalDetailPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const params = useParams();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const { data, isLoading, isError, refetch, isFetching } = useProposalDetail(valid ? id : 0);
  const p = data?.proposal;
  // the Proposals list passes its filter and search along, so "back" returns to the same view
  const state = useLocation().state as { from?: unknown } | null;
  const from = typeof state?.from === 'string' && state.from.startsWith('?') && state.from.length < 300 ? state.from : '';

  const share = async (): Promise<void> => {
    try {
      if (navigator.share) {
        await navigator.share({ title: p?.title ?? 'ChainBeat', url: window.location.href });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // the visitor closed the share sheet
    }
    if (await copyText(window.location.href)) toast.success(t('footer.linkCopied'));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={p ? '#' + p.id + ' · ' + p.title : valid ? t('proposalsPage.detailTitle', { id }) : t('proposalsPage.invalid')}
        description={t('proposalsPage.simulatedText')}
        badge={
          <>
            <DemoBadge label={t('common.simulated')} />
            {p ? <CopyButton value={String(p.id)} label={t('proposalsPage.copyId')} /> : null}
          </>
        }
        actions={
          <>
            {p ? (
              <Button variant="ghost" size="sm" onClick={() => void share()}>
                <Share2 className="size-4" aria-hidden /> {t('footer.share')}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" asChild>
              <Link to={paths.proposals + from}>
                <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t('navigation.proposals')}
              </Link>
            </Button>
          </>
        }
      />
      {!valid || (!isLoading && !isError && !p) ? (
        <Panel>
          <EmptyState title={t('proposalsPage.notFoundTitle')} description={t('proposalsPage.notFoundBody', { chain: chain.name })} action={<Button asChild variant="primary"><Link to={paths.proposals}>{t('navigation.proposals')}</Link></Button>} />
        </Panel>
      ) : isLoading ? (
        <Skeleton className="h-[320px] rounded-2xl" />
      ) : isError || !p || !data ? (
        <Panel>
          <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Panel className="space-y-4 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <ProposalStatusBadge status={p.status} />
                <Badge>{t('proposalsPage.types.' + p.type)}</Badge>
                {p.demo ? <Badge tone="yellow">{t('proposalsPage.demoProposal')}</Badge> : null}
              </div>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
                {[
                  [t('proposalsPage.proposer'), <AddressLink key="a" address={p.proposer} head={10} tail={6} />],
                  [t('proposalsPage.submitted'), fmt.dateTime(p.submitTime, { dateStyle: 'medium', timeStyle: 'short' })],
                  ...(p.status === 'deposit' ? [] : [[t('proposalsPage.votingStart'), fmt.dateTime(p.submitTime, { dateStyle: 'medium', timeStyle: 'short' })]]),
                  [t('proposalsPage.votingEnd'), fmt.dateTime(p.votingEnd, { dateStyle: 'medium', timeStyle: 'short' })],
                  [t('proposalsPage.deposit'), fmt.token(p.deposit, chain.symbol, 0) + ' / ' + fmt.token(p.minDeposit, chain.symbol, 0)],
                  [t('proposalsPage.network'), chain.name],
                  [t('proposalsPage.votingPeriod'), fmt.days(Math.round((p.votingEnd - p.submitTime) / DAY_MS))],
                ].map(([k, v], i) => (
                  <div key={i} className="flex items-start justify-between gap-4 border-b border-line pb-2.5">
                    <dt className="shrink-0 text-fg-3">{k}</dt>
                    <dd className="min-w-0 text-end font-medium text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
              <section aria-labelledby="proposal-description">
                <h2 id="proposal-description" className="mb-1.5 font-display text-[14px] font-semibold">
                  {t('proposalsPage.bodyHeading')}
                </h2>
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-fg-2">{p.description}</p>
              </section>
            </Panel>
            <Panel className="space-y-3 p-4" id="vote">
              <h2 className="font-display text-[15px] font-semibold">{t('proposalsPage.voteHere')}</h2>
              {p.status === 'voting' ? <VotingPanel proposal={p} /> : <p className="text-[12.5px] text-fg-3">{p.status === 'deposit' ? t('proposalsPage.inDeposit') : t('proposalsPage.votingClosed')}</p>}
            </Panel>
          </div>
          <div className="space-y-4">
            <TallyPanel detail={data} />
            <HistoryPanel proposal={p} />
          </div>
        </div>
      )}
    </div>
  );
}
