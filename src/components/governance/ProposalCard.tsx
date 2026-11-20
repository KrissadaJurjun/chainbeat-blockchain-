import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { useFormat } from '@/hooks/useFormat';
import { useMyVote } from '@/hooks/useGovernance';
import { paths } from '@/lib/paths';
import { getSimNow } from '@/stores/simStore';
import type { Proposal } from '@/types/domain';
import { ProposalStatusBadge, TallyBar } from './Tally';

/** A proposal in a list: status, title, tally and the two actions (details, vote). */
export function ProposalCard({ proposal: p }: { proposal: Proposal }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const mine = useMyVote(p.id);
  // when this card is on the Proposals list, remember its filter and search so "back" returns to the same view
  const { pathname, search } = useLocation();
  const state = pathname === paths.proposals && search ? { from: search } : undefined;
  return (
    <Panel className="flex h-full flex-col p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[12px] text-fg-3 2xl:text-[12.5px]">#{p.id}</span>
        <ProposalStatusBadge status={p.status} />
        <Badge>{t('proposalsPage.types.' + p.type)}</Badge>
        {p.demo ? <Badge tone="yellow">{t('common.demo')}</Badge> : null}
        <span className="ms-auto text-[11.5px] text-fg-3 2xl:text-[12px]">{p.status === 'voting' ? t('proposals.endsIn', { time: fmt.relative(p.votingEnd, getSimNow()) }) : fmt.date(p.votingEnd)}</span>
      </div>
      <h2 className="mt-2.5 break-words text-[14px] font-semibold leading-snug text-fg 2xl:text-[14.5px]">
        <Link to={paths.proposal(p.id)} state={state} className="hover:text-cyan hover:underline">
          {p.title}
        </Link>
      </h2>
      <p className="mt-1 line-clamp-2 break-words text-[12.5px] leading-relaxed text-fg-3 2xl:text-[13px]">{p.summary}</p>
      <TallyBar tally={p.tally} className="mt-3.5" />
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3 text-[12px] text-fg-3 2xl:text-[13px]">
        <span>
          {t('proposals.turnout')} <b className="font-semibold tabular-nums text-fg-2">{fmt.percent(p.turnout, 1)}</b>
          {mine ? <span className="ms-2 text-green">· {t('vote.yourVote', { option: t('vote.options.' + mine) })}</span> : null}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" className="2xl:h-[33px] 2xl:px-3.5 2xl:text-[13px]" asChild>
            <Link to={paths.proposal(p.id)} state={state}>{t('common.details')}</Link>
          </Button>
          {p.status === 'voting' ? (
            <Button size="sm" className="2xl:h-[33px] 2xl:px-3.5 2xl:text-[13px]" asChild>
              <Link to={paths.proposal(p.id) + '#vote'} state={state}>{t('proposals.vote')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
