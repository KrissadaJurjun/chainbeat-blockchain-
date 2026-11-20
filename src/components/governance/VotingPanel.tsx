import { useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { DemoNotice } from '@/components/ui/Demo';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { WalletGate } from '@/components/wallet/WalletGate';
import { useFormat } from '@/hooks/useFormat';
import { useMyVote, useVoteWeight } from '@/hooks/useGovernance';
import { VOTE_OPTIONS, type VoteOption } from '@/lib/governance';
import { cn } from '@/lib/utils';
import { useChain } from '@/stores/chainStore';
import { toast } from '@/stores/toastStore';
import { useWalletStore } from '@/stores/walletStore';
import type { Proposal } from '@/types/domain';
import { TALLY_COLORS } from './Tally';

/** Cast (or change) the Demo wallet's vote: pick an option, review it in a confirmation dialog, confirm. Simulated. */
export function VotingPanel({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const weight = useVoteWeight();
  const current = useMyVote(proposal.id);
  const [choice, setChoice] = useState<VoteOption | undefined>(undefined);
  const [reviewing, setReviewing] = useState(false);
  const selected = choice ?? current;

  const confirm = (): void => {
    if (!selected) return;
    const store = useWalletStore.getState();
    store.setVote(chain.id + ':' + proposal.id, selected);
    store.record('vote', { id: proposal.id, option: t('vote.options.' + selected) });
    toast.success(t('vote.done'), t('vote.doneBody'));
    setReviewing(false);
    setChoice(undefined);
  };

  return (
    <WalletGate>
      <div className="space-y-4">
        <DemoNotice>{t('vote.notice')}</DemoNotice>
        <div role="radiogroup" aria-label={t('vote.choose')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VOTE_OPTIONS.map((o) => {
            const on = selected === o;
            return (
              <label
                key={o}
                className={cn(
                  'flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan/60',
                  on ? 'border-active-line bg-active text-fg' : 'border-line-strong text-fg-2 hover:bg-hover',
                )}
              >
                <input type="radio" name={'vote-' + proposal.id} value={o} checked={on} onChange={() => setChoice(o)} className="sr-only" />
                <i className="size-2 rounded-full" style={{ background: TALLY_COLORS[o] }} aria-hidden />
                {t('vote.options.' + o)}
              </label>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {current ? (
            <p className="inline-flex items-center gap-1.5 text-[12.5px] text-green">
              <CircleCheck className="size-4" aria-hidden /> {t('vote.yourVote', { option: t('vote.options.' + current) })}
            </p>
          ) : (
            <span className="text-[12px] text-fg-3">{t('vote.notVoted')}</span>
          )}
          <Button variant="primary" disabled={!selected || selected === current} onClick={() => setReviewing(true)}>
            {t('vote.review')}
          </Button>
        </div>
        <Dialog open={reviewing} onOpenChange={setReviewing}>
          <DialogContent title={t('vote.confirmTitle')} description={t('vote.confirmBody')} size="sm">
            <dl className="divide-y divide-line rounded-xl border border-line bg-card/40 text-[12.5px]">
              <div className="flex justify-between gap-4 px-3 py-2">
                <dt className="text-fg-3">{t('vote.proposal')}</dt>
                <dd className="text-end font-medium text-fg">#{proposal.id}</dd>
              </div>
              <div className="flex justify-between gap-4 px-3 py-2">
                <dt className="text-fg-3">{t('vote.choose')}</dt>
                <dd className="font-medium text-fg">{selected ? t('vote.options.' + selected) : ''}</dd>
              </div>
              <div className="flex justify-between gap-4 px-3 py-2">
                <dt className="text-fg-3">{t('vote.weight')}</dt>
                <dd className="font-medium tabular-nums text-fg">{fmt.token(weight, chain.symbol, 2)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] leading-relaxed text-fg-3">{t('vote.weightNote')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">{t('common.cancel')}</Button>
              </DialogClose>
              <Button variant="primary" onClick={confirm}>
                {t('vote.confirm')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </WalletGate>
  );
}
