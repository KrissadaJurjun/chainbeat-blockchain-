import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { DemoBadge, DemoNotice } from '@/components/ui/Demo';
import { Field, Input, Textarea, fieldAria } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { ActivityList } from '@/components/wallet/ActivityList';
import { AmountField } from '@/components/wallet/AmountField';
import { TransactionConfirmDialog } from '@/components/wallet/ConfirmDialog';
import { WalletGate } from '@/components/wallet/WalletGate';
import { useFormat } from '@/hooks/useFormat';
import { bech32Encode, checkAddress } from '@/lib/bech32';
import { DEMO_FEE, makeDemoTx } from '@/lib/demoTx';

import { randomBytes, rngFor } from '@/lib/prng';
import { shortHash, uid } from '@/lib/utils';
import { countDecimals, floorTo, parseAmount } from '@/lib/validation';
import { getAsset } from '@/services/chain/registry';
import { useChain } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';
import { toast } from '@/stores/toastStore';
import { useWalletStore } from '@/stores/walletStore';

/** Simulated flat network fee, in the chain's native token. */
const FEE = DEMO_FEE;
const MEMO_MAX = 256;

interface SendForm {
  asset: string;
  recipient: string;
  amount: string;
  memo: string;
}

export default function SendPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const balances = useWalletStore((s) => s.ledger.balances);
  const address = useWalletStore((s) => s.address);
  const [pending, setPending] = useState<SendForm | null>(null);

  const symbols = useMemo(() => Array.from(new Set([chain.symbol, ...Object.keys(balances).filter((s) => (balances[s] ?? 0) > 0)])), [balances, chain.symbol]);

  const schema = useMemo(
    () =>
      z
        .object({ asset: z.string().min(1), recipient: z.string(), amount: z.string(), memo: z.string().max(MEMO_MAX, t('send.errors.memoLong', { max: MEMO_MAX })) })
        .superRefine((v, ctx) => {
          const addr = v.recipient.trim();
          if (!addr) ctx.addIssue({ code: 'custom', path: ['recipient'], message: t('send.errors.recipientRequired') });
          else {
            const check = checkAddress(addr, chain.bech32Prefix);
            if (!check.ok) {
              const message = check.reason === 'prefix' ? t('send.errors.addressPrefix', { prefix: chain.bech32Prefix }) : check.reason === 'length' ? t('send.errors.addressLength') : t('send.errors.addressFormat');
              ctx.addIssue({ code: 'custom', path: ['recipient'], message });
            }
          }
          const n = parseAmount(v.amount);
          const balance = balances[v.asset] ?? 0;
          const needed = v.asset === chain.symbol ? n + FEE : n;
          const digits = getAsset(v.asset).decimals;
          if (!Number.isFinite(n) || n <= 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: t('swap.errors.amountInvalid') });
          else if (n > 1e15) ctx.addIssue({ code: 'custom', path: ['amount'], message: t('send.errors.tooLarge') });
          else if (countDecimals(v.amount) > digits) ctx.addIssue({ code: 'custom', path: ['amount'], message: t('send.errors.precision', { symbol: v.asset, digits }) });
          else if (needed > balance) ctx.addIssue({ code: 'custom', path: ['amount'], message: t('swap.errors.insufficient', { symbol: v.asset }) });
        }),
    [t, chain.bech32Prefix, chain.symbol, balances],
  );

  const form = useForm<SendForm>({ resolver: zodResolver(schema), mode: 'onChange', defaultValues: { asset: chain.symbol, recipient: '', amount: '', memo: '' } });
  const { register, watch, setValue, handleSubmit, formState } = form;
  const values = watch();
  const balance = balances[values.asset] ?? 0;
  const maxSpend = values.asset === chain.symbol ? Math.max(0, balance - FEE) : balance;

  const useSample = (): void => {
    const sample = bech32Encode(chain.bech32Prefix, randomBytes(rngFor('sample-recipient', chain.id), 20));
    setValue('recipient', sample, { shouldValidate: true, shouldDirty: true });
  };

  // step 1: validate, then ask for confirmation — nothing changes yet
  const onSubmit = handleSubmit((v) => setPending(v));

  // step 2: the user confirmed — update the Demo ledger and create the synthetic transaction
  const confirm = (): void => {
    if (!pending || !address) return;
    const n = parseAmount(pending.amount);
    const recipient = pending.recipient.trim();
    const store = useWalletStore.getState();
    const tx = makeDemoTx(chain, getSimNow(), { type: 'send', from: address, to: recipient, amount: n, symbol: pending.asset, memo: pending.memo.trim(), seed: uid('send') });
    store.adjustBalance(pending.asset, -n);
    if (pending.asset === chain.symbol) store.adjustBalance(chain.symbol, -FEE);
    store.recordTx('send', { amountAmt: n, symbol: pending.asset, to: shortHash(recipient, 10, 6) }, tx);
    toast.success(t('send.done'), t('send.doneBody'));
    form.reset({ asset: pending.asset, recipient: '', amount: '', memo: '' });
    setPending(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.send')} description={t('send.description', { chain: chain.name })} badge={<DemoBadge label={t('common.simulated')} />} />
      <WalletGate>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel className="p-5">
            <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={t('navigation.send')}>
              <Field label={t('send.asset')} htmlFor="send-asset">
                <Select id="send-asset" aria-label={t('send.asset')} value={values.asset} onValueChange={(v) => setValue('asset', v, { shouldValidate: true })} options={symbols.map((s) => ({ value: s, label: s }))} />
              </Field>
              <Field
                label={t('send.recipient')}
                htmlFor="send-recipient"
                error={formState.errors.recipient?.message}
                hint={t('send.recipientHint', { prefix: chain.bech32Prefix })}
                aside={
                  <button type="button" onClick={useSample} className="text-[11.5px] font-medium text-cyan hover:underline">
                    {t('send.useSample')}
                  </button>
                }
              >
                <Input {...fieldAria('send-recipient', formState.errors.recipient?.message, true)} {...register('recipient')} dir="ltr" spellCheck={false} autoComplete="off" autoCapitalize="off" placeholder={`${chain.bech32Prefix}1…`} className="font-mono text-[12.5px]" />
              </Field>
              <AmountField
                id="send-amount"
                label={t('common.amount')}
                register={register('amount')}
                error={formState.errors.amount?.message}
                balance={balance}
                symbol={values.asset}
                onMax={() => setValue('amount', String(floorTo(maxSpend, 6)), { shouldValidate: true })}
                trailing={values.asset}
              />
              <Field label={t('send.memo')} htmlFor="send-memo" error={formState.errors.memo?.message} hint={t('send.memoHint', { count: values.memo.length, max: MEMO_MAX })}>
                <Textarea {...fieldAria('send-memo', formState.errors.memo?.message, true)} {...register('memo')} rows={2} className="min-h-[64px]" />
              </Field>
              <dl className="divide-y divide-line rounded-xl border border-line bg-card/40 text-[12.5px]">
                <div className="flex items-center justify-between gap-4 px-3 py-2">
                  <dt className="text-fg-3">{t('send.networkFee')}</dt>
                  <dd className="font-medium tabular-nums text-fg">{fmt.token(FEE, chain.symbol, 4)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-3 py-2">
                  <dt className="text-fg-3">{t('send.network')}</dt>
                  <dd className="font-medium text-fg">{chain.name}</dd>
                </div>
              </dl>
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!formState.isValid}>
                {t('send.review')}
              </Button>
              <DemoNotice>{t('send.notice')}</DemoNotice>
            </form>
          </Panel>
          <Panel className="p-4">
            <h2 className="mb-1 font-display text-[15px] font-semibold">{t('wallet.activity.title')}</h2>
            <ActivityList />
          </Panel>
        </div>
        <TransactionConfirmDialog
          open={pending !== null}
          onOpenChange={(open) => !open && setPending(null)}
          description={t('send.confirmDescription')}
          confirmLabel={t('send.submit')}
          onConfirm={confirm}
          rows={
            pending
              ? [
                  [t('wallet.confirm.network'), chain.name],
                  [t('send.recipientShort'), <span key="r" dir="ltr" className="ltr-isolate break-all font-mono text-[11.5px]">{pending.recipient.trim()}</span>],
                  [t('common.amount'), fmt.token(parseAmount(pending.amount), pending.asset, 6)],
                  [t('wallet.confirm.fee'), fmt.token(FEE, chain.symbol, 4)],
                  ...(pending.memo.trim() ? ([[t('send.memo'), pending.memo.trim()]] as const) : []),
                ]
              : []
          }
        />
      </WalletGate>
    </div>
  );
}
