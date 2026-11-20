import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { fullLg, wrapMd, wrapSm } from '@/components/ui/buttonWrap';
import { DemoBadge, DemoNotice } from '@/components/ui/Demo';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field, Input, Textarea, fieldAria } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { ActivityList } from '@/components/wallet/ActivityList';
import { AmountField } from '@/components/wallet/AmountField';
import { WalletGate } from '@/components/wallet/WalletGate';
import { useProposals } from '@/hooks/useGovernance';
import { useFormat } from '@/hooks/useFormat';
import { checkAddress } from '@/lib/bech32';
import { paths } from '@/lib/paths';
import { floorTo, parseAmount } from '@/lib/validation';
import { useChain } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';
import { toast } from '@/stores/toastStore';
import { useWalletStore } from '@/stores/walletStore';

const TYPES = ['text', 'parameter', 'spend', 'upgrade', 'ibc', 'other'] as const;
const TITLE_MIN = 10;
const TITLE_MAX = 120;
const BODY_MIN = 40;
const BODY_MAX = 2000;

interface ProposalForm {
  type: (typeof TYPES)[number];
  title: string;
  description: string;
  deposit: string;
  recipient: string;
  spend: string;
  votingDays: string;
}

export default function CreateProposalPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const proposals = useProposals().data;
  const balance = useWalletStore((s) => s.ledger.balances[chain.symbol] ?? 0);
  const navigate = useNavigate();
  const allMine = useWalletStore((s) => s.ledger.proposals);
  const mine = useMemo(() => allMine.filter((p) => p.chainId === chain.id), [allMine, chain.id]);
  const [pending, setPending] = useState<ProposalForm | null>(null);
  const minDeposit = proposals?.items[0]?.minDeposit ?? Math.max(100, Math.round(5000 / chain.basePriceUsd / 100) * 100);
  // voting periods to choose from: the network's own and a few shorter or longer ones
  const durations = useMemo(() => Array.from(new Set([chain.votingPeriodDays, 3, 5, 7, 14])).sort((a, b) => a - b), [chain.votingPeriodDays]);
  // the saved draft of this network (if any) is what the form starts from
  const draft = useWalletStore((s) => s.ledger.draft);
  const myDraft = draft && draft.chainId === chain.id ? draft : null;
  const [restored, setRestored] = useState(myDraft !== null);

  const schema = useMemo(
    () =>
      z
        .object({
          type: z.enum(TYPES),
          title: z.string().trim().min(TITLE_MIN, t('createProposal.errors.titleShort', { min: TITLE_MIN })).max(TITLE_MAX, t('createProposal.errors.titleLong', { max: TITLE_MAX })),
          description: z.string().trim().min(BODY_MIN, t('createProposal.errors.bodyShort', { min: BODY_MIN })).max(BODY_MAX, t('createProposal.errors.bodyLong', { max: BODY_MAX })),
          deposit: z.string(),
          recipient: z.string(),
          spend: z.string(),
          votingDays: z.string(),
        })
        .superRefine((v, ctx) => {
          const dep = parseAmount(v.deposit);
          if (!Number.isFinite(dep) || dep <= 0) ctx.addIssue({ code: 'custom', path: ['deposit'], message: t('swap.errors.amountInvalid') });
          else if (dep < minDeposit) ctx.addIssue({ code: 'custom', path: ['deposit'], message: t('createProposal.errors.depositLow', { min: fmt.number(minDeposit), symbol: chain.symbol }) });
          else if (dep > balance) ctx.addIssue({ code: 'custom', path: ['deposit'], message: t('swap.errors.insufficient', { symbol: chain.symbol }) });
          if (v.type === 'spend') {
            if (!checkAddress(v.recipient.trim(), chain.bech32Prefix).ok) ctx.addIssue({ code: 'custom', path: ['recipient'], message: t('send.errors.addressFormat') });
            const s = parseAmount(v.spend);
            if (!Number.isFinite(s) || s <= 0) ctx.addIssue({ code: 'custom', path: ['spend'], message: t('swap.errors.amountInvalid') });
          }
        }),
    [t, fmt, minDeposit, balance, chain.symbol, chain.bech32Prefix],
  );

  const blank = (): ProposalForm => ({ type: 'text', title: '', description: '', deposit: String(minDeposit), recipient: '', spend: '', votingDays: String(chain.votingPeriodDays) });
  const form = useForm<ProposalForm>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: myDraft
      ? { type: myDraft.type, title: myDraft.title, description: myDraft.description, deposit: myDraft.deposit, recipient: myDraft.recipient, spend: myDraft.spend, votingDays: myDraft.votingDays }
      : blank(),
  });
  const { register, watch, setValue, handleSubmit, formState } = form;
  const values = watch();
  const deposit = parseAmount(values.deposit);
  const depositPct = Number.isFinite(deposit) ? Math.min(1, deposit / minDeposit) : 0;

  const saveDraft = (): void => {
    const v = form.getValues();
    useWalletStore.getState().saveDraft({ chainId: chain.id, type: v.type, title: v.title, description: v.description, deposit: v.deposit, recipient: v.recipient, spend: v.spend, votingDays: v.votingDays });
    toast.success(t('createProposal.draftSaved'));
  };
  const discardDraft = (): void => {
    useWalletStore.getState().clearDraft();
    form.reset(blank());
    setRestored(false);
  };

  // step 1: validate and open the confirmation dialog; nothing changes yet
  const onSubmit = handleSubmit((v) => setPending(v));

  // step 2: the user confirmed — create the simulated proposal and show it
  const confirm = (): void => {
    if (!pending) return;
    const dep = parseAmount(pending.deposit);
    const store = useWalletStore.getState();
    store.adjustBalance(chain.symbol, -dep);
    const created = store.addProposal(chain, { title: pending.title.trim(), description: pending.description.trim(), type: pending.type, deposit: dep, votingDays: Number(pending.votingDays) || chain.votingPeriodDays }, getSimNow());
    store.clearDraft();
    setRestored(false);
    store.record('proposal', { title: pending.title.trim(), depositAmt: dep, symbol: chain.symbol });
    toast.success(t('createProposal.done'), t('createProposal.doneBody', { id: created.id }));
    form.reset({ ...pending, title: '', description: '', recipient: '', spend: '' });
    setPending(null);
    navigate(paths.proposal(created.id));
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.createProposal')} description={t('createProposal.description', { chain: chain.name })} badge={<DemoBadge label={t('common.simulated')} />} />
      <WalletGate>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel className="p-5">
            <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={t('navigation.createProposal')}>
              {restored ? (
                <p role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan/25 bg-cyan/8 px-3 py-2 text-[12.5px] text-fg-2">
                  <span>{t('createProposal.draftRestored')}</span>
                  <Button variant="ghost" size="sm" className={wrapSm} onClick={discardDraft}>
                    {t('createProposal.draftDiscard')}
                  </Button>
                </p>
              ) : null}
              <Field label={t('createProposal.type')} htmlFor="proposal-type">
                <Select id="proposal-type" aria-label={t('createProposal.type')} value={values.type} onValueChange={(v) => setValue('type', v as ProposalForm['type'], { shouldValidate: true })} options={TYPES.map((x) => ({ value: x, label: t(`proposalsPage.types.${x}`) }))} />
              </Field>
              <Field label={t('createProposal.duration')} htmlFor="proposal-duration">
                <Select id="proposal-duration" aria-label={t('createProposal.duration')} value={values.votingDays} onValueChange={(v) => setValue('votingDays', v)} options={durations.map((d) => ({ value: String(d), label: fmt.days(d) }))} />
              </Field>
              <Field label={t('createProposal.title')} htmlFor="proposal-title" error={formState.errors.title?.message} hint={t('createProposal.titleHint', { count: values.title.length, max: TITLE_MAX })}>
                <Input {...fieldAria('proposal-title', formState.errors.title?.message, true)} {...register('title')} maxLength={TITLE_MAX + 40} autoComplete="off" />
              </Field>
              <Field label={t('createProposal.body')} htmlFor="proposal-body" error={formState.errors.description?.message} hint={t('createProposal.bodyHint', { count: values.description.length, max: BODY_MAX })}>
                <Textarea {...fieldAria('proposal-body', formState.errors.description?.message, true)} {...register('description')} rows={6} />
              </Field>
              {values.type === 'spend' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('createProposal.recipient')} htmlFor="proposal-recipient" error={formState.errors.recipient?.message}>
                    <Input {...fieldAria('proposal-recipient', formState.errors.recipient?.message)} {...register('recipient')} dir="ltr" spellCheck={false} autoComplete="off" placeholder={`${chain.bech32Prefix}1…`} className="font-mono text-[12.5px]" />
                  </Field>
                  <AmountField id="proposal-spend" label={t('createProposal.spend')} register={register('spend')} error={formState.errors.spend?.message} trailing={chain.symbol} />
                </div>
              ) : null}
              <AmountField
                id="proposal-deposit"
                label={t('createProposal.deposit')}
                register={register('deposit')}
                error={formState.errors.deposit?.message}
                balance={balance}
                symbol={chain.symbol}
                onMax={() => setValue('deposit', String(floorTo(balance, 6)), { shouldValidate: true })}
                trailing={chain.symbol}
                hint={t('createProposal.depositHint', { min: fmt.number(minDeposit), symbol: chain.symbol })}
              />
              <Button type="submit" variant="primary" size="lg" className={fullLg} disabled={!formState.isValid}>
                {t('createProposal.submit')}
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className={wrapMd} onClick={saveDraft} disabled={!values.title.trim() && !values.description.trim()}>
                  <Save className="size-4" aria-hidden /> {t('createProposal.saveDraft')}
                </Button>
                <Button variant="ghost" className={wrapMd} onClick={() => navigate(paths.proposals)}>
                  {t('common.cancel')}
                </Button>
              </div>
              <DemoNotice>{t('createProposal.notice')}</DemoNotice>
            </form>
          </Panel>

          <div className="space-y-4">
            <Panel className="p-4" aria-label={t('createProposal.preview')}>
              <h2 className="mb-3 font-display text-[15px] font-semibold">{t('createProposal.preview')}</h2>
              <article className="rounded-xl border border-line bg-gradient-to-b from-card to-panel p-3.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-fg-3">#{(proposals?.total ?? 0) + 1}</span>
                  <Badge tone="yellow">{t('proposals.status.deposit')}</Badge>
                  <Badge>{t(`proposalsPage.types.${values.type}`)}</Badge>
                </div>
                <h3 className="mt-2 text-[13px] font-semibold leading-snug text-fg">{values.title.trim() || t('createProposal.previewTitle')}</h3>
                <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-fg-3">{values.description.trim() || t('createProposal.previewBody')}</p>
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-line" role="img" aria-label={t('createProposal.depositProgress', { percent: Math.round(depositPct * 100) })}>
                    <div className="h-full rounded-full bg-yellow transition-[width] duration-300" style={{ width: `${depositPct * 100}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-fg-3">
                    {t('createProposal.depositOf', { current: fmt.number(Number.isFinite(deposit) ? deposit : 0), min: fmt.number(minDeposit), symbol: chain.symbol })}
                  </p>
                </div>
              </article>
            </Panel>
            <Panel className="p-4">
              <h2 className="mb-2 font-display text-[15px] font-semibold">{t('createProposal.drafts')}</h2>
              {mine.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-fg-3">{t('createProposal.noDrafts')}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {mine.map((d) => (
                    <li key={d.key} className="py-2.5">
                      <Link to={paths.proposal(d.id)} className="text-[13px] font-medium text-fg hover:text-cyan hover:underline">
                        #{d.id} · {d.title}
                      </Link>
                      <p className="mt-0.5 text-[11.5px] text-fg-3">
                        {t(`proposalsPage.types.${d.type}`)} · {fmt.token(d.deposit, chain.symbol, 2)} · {fmt.relative(d.submittedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel className="p-4">
              <h2 className="mb-1 font-display text-[15px] font-semibold">{t('wallet.activity.title')}</h2>
              <ActivityList limit={4} />
            </Panel>
          </div>
        </div>
        <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
          <DialogContent title={t('createProposal.confirmTitle')} description={t('createProposal.confirmBody')} size="sm">
            {pending ? (
              <dl className="divide-y divide-line rounded-xl border border-line bg-card/40 text-[12.5px]">
                <div className="flex justify-between gap-4 px-3 py-2">
                  <dt className="text-fg-3">{t('createProposal.title')}</dt>
                  <dd className="text-end font-medium text-fg">{pending.title.trim()}</dd>
                </div>
                <div className="flex justify-between gap-4 px-3 py-2">
                  <dt className="text-fg-3">{t('createProposal.type')}</dt>
                  <dd className="font-medium text-fg">{t('proposalsPage.types.' + pending.type)}</dd>
                </div>
                <div className="flex justify-between gap-4 px-3 py-2">
                  <dt className="text-fg-3">{t('createProposal.duration')}</dt>
                  <dd className="font-medium text-fg">{fmt.days(Number(pending.votingDays) || chain.votingPeriodDays)}</dd>
                </div>
                <div className="flex justify-between gap-4 px-3 py-2">
                  <dt className="text-fg-3">{t('createProposal.deposit')}</dt>
                  <dd className="font-medium tabular-nums text-fg">{fmt.token(parseAmount(pending.deposit), chain.symbol, 2)}</dd>
                </div>
              </dl>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">{t('common.cancel')}</Button>
              </DialogClose>
              <Button variant="primary" onClick={confirm}>
                {t('createProposal.confirm')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </WalletGate>
    </div>
  );
}
