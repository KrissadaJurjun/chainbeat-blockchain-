import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownUp } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { DemoBadge, DemoNotice } from '@/components/ui/Demo';
import { Field } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { ActivityList } from '@/components/wallet/ActivityList';
import { AmountField } from '@/components/wallet/AmountField';
import { TransactionConfirmDialog } from '@/components/wallet/ConfirmDialog';
import { WalletGate } from '@/components/wallet/WalletGate';
import { useFormat } from '@/hooks/useFormat';
import { usePrices } from '@/hooks/usePrices';
import { makeDemoTx } from '@/lib/demoTx';
import { uid } from '@/lib/utils';
import { floorTo, parseAmount } from '@/lib/validation';
import { useChain } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';
import { toast } from '@/stores/toastStore';
import { useWalletStore } from '@/stores/walletStore';

const TOKENS = ['ATOM', 'OSMO', 'USDC', 'BTC', 'ETH', 'TIA'] as const;
const FEE_RATE = 0.003;
/** Simulated pool depth: larger swaps move the price more (a constant-product-style impact estimate). */
const POOL_DEPTH_USD = 2_500_000;

interface SwapForm {
  from: string;
  to: string;
  amount: string;
}

export default function SwapPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const { prices } = usePrices();
  const balances = useWalletStore((s) => s.ledger.balances);
  const chain = useChain();
  const address = useWalletStore((s) => s.address);
  const [slippage, setSlippage] = useState('0.5');
  const [pending, setPending] = useState<SwapForm | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({ from: z.string().min(1), to: z.string().min(1), amount: z.string() })
        .superRefine((v, ctx) => {
          if (v.from === v.to) ctx.addIssue({ code: 'custom', path: ['to'], message: t('swap.errors.sameToken') });
          const n = parseAmount(v.amount);
          if (!Number.isFinite(n) || n <= 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: t('swap.errors.amountInvalid') });
          else if (n > (balances[v.from] ?? 0)) ctx.addIssue({ code: 'custom', path: ['amount'], message: t('swap.errors.insufficient', { symbol: v.from }) });
        }),
    [t, balances],
  );

  const form = useForm<SwapForm>({ resolver: zodResolver(schema), mode: 'onChange', defaultValues: { from: 'ATOM', to: 'OSMO', amount: '' } });
  const { register, watch, setValue, handleSubmit, formState } = form;
  const values = watch();

  const amountIn = parseAmount(values.amount);
  const valid = Number.isFinite(amountIn) && amountIn > 0;
  const priceFrom = prices[values.from] ?? 0;
  const priceTo = prices[values.to] ?? 0;
  const rate = priceTo ? priceFrom / priceTo : 0;
  const amountUsd = valid ? amountIn * priceFrom : 0;
  const impact = Math.min(0.15, amountUsd / POOL_DEPTH_USD);
  const out = valid ? amountIn * rate * (1 - FEE_RATE) * (1 - impact) : 0;
  const minOut = out * (1 - Number(slippage) / 100);
  const balance = balances[values.from] ?? 0;

  const flip = (): void => {
    setValue('from', values.to, { shouldValidate: true });
    setValue('to', values.from, { shouldValidate: true });
  };

  // step 1: validate, then ask for confirmation — nothing changes yet
  const onSubmit = handleSubmit((v) => setPending(v));

  // step 2: confirmed — update the simulated balances and create the synthetic transaction
  const confirm = (): void => {
    if (!pending || !address) return;
    const n = parseAmount(pending.amount);
    const store = useWalletStore.getState();
    const tx = makeDemoTx(chain, getSimNow(), { type: 'swap', from: address, amount: n, symbol: pending.from, seed: uid('swap') });
    store.adjustBalance(pending.from, -n);
    store.adjustBalance(pending.to, out);
    store.recordTx('swap', { amountInAmt: n, from: pending.from, amountOutAmt: out, to: pending.to }, tx);
    toast.success(t('swap.done'), t('swap.doneBody'));
    form.reset({ ...pending, amount: '' });
    setPending(null);
  };

  const tokenOptions = TOKENS.map((s) => ({ value: s, label: s }));

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.swap')} description={t('swap.description')} badge={<DemoBadge label={t('common.simulated')} />} />
      <WalletGate>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel className="p-5">
            <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={t('navigation.swap')}>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field label={t('swap.from')} htmlFor="swap-from">
                  <Select id="swap-from" aria-label={t('swap.from')} value={values.from} onValueChange={(v) => setValue('from', v, { shouldValidate: true })} options={tokenOptions} />
                </Field>
                <div className="hidden items-end sm:flex">
                  <Button type="button" variant="secondary" size="icon" aria-label={t('swap.flip')} onClick={flip}>
                    <ArrowDownUp className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
              <AmountField
                id="swap-amount"
                label={t('swap.youPay')}
                register={register('amount')}
                error={formState.errors.amount?.message}
                balance={balance}
                symbol={values.from}
                onMax={() => setValue('amount', String(floorTo(balance, 6)), { shouldValidate: true })}
                trailing={values.from}
              />
              <div className="flex sm:hidden">
                <Button type="button" variant="secondary" size="sm" onClick={flip}>
                  <ArrowDownUp className="size-4" aria-hidden /> {t('swap.flip')}
                </Button>
              </div>
              <Field label={t('swap.to')} htmlFor="swap-to" error={formState.errors.to?.message}>
                <Select id="swap-to" aria-label={t('swap.to')} value={values.to} onValueChange={(v) => setValue('to', v, { shouldValidate: true })} options={tokenOptions} invalid={Boolean(formState.errors.to)} />
              </Field>
              <AmountField id="swap-out" label={t('swap.youReceive')} readOnly value={valid ? fmt.number(out, { maximumFractionDigits: 6 }) : ''} trailing={values.to} placeholder="0.00" />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[12px] font-medium text-fg-2">{t('swap.slippage')}</span>
                <Segmented aria-label={t('swap.slippage')} size="sm" value={slippage} onChange={setSlippage} options={['0.1', '0.5', '1'].map((v) => ({ value: v, label: `${v}%` }))} />
              </div>

              <dl className="divide-y divide-line rounded-xl border border-line bg-card/40 text-[12.5px]" aria-label={t('swap.quote')}>
                {[
                  [t('swap.rate'), `1 ${values.from} ≈ ${fmt.number(rate, { maximumFractionDigits: 6 })} ${values.to}`],
                  [t('swap.fee'), fmt.percent(FEE_RATE, 2)],
                  [t('swap.impact'), valid ? fmt.percent(impact, 3) : '—'],
                  [t('swap.minReceived'), valid ? `${fmt.number(minOut, { maximumFractionDigits: 6 })} ${values.to}` : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 px-3 py-2">
                    <dt className="text-fg-3">{k}</dt>
                    <dd className="font-medium tabular-nums text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!formState.isValid}>
                {t('swap.review')}
              </Button>
              <DemoNotice>{t('swap.notice')}</DemoNotice>
            </form>
          </Panel>

          <div className="space-y-4">
            <Panel className="p-4">
              <h2 className="mb-2 font-display text-[15px] font-semibold">{t('swap.balances')}</h2>
              <ul className="divide-y divide-line text-[13px]">
                {TOKENS.map((s) => (
                  <li key={s} className="flex items-center justify-between py-2">
                    <span className="font-medium text-fg">{s}</span>
                    <span className="tabular-nums text-fg-2">{fmt.number(balances[s] ?? 0, { maximumFractionDigits: 6 })}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel className="p-4">
              <h2 className="mb-1 font-display text-[15px] font-semibold">{t('wallet.activity.title')}</h2>
              <ActivityList limit={5} />
            </Panel>
          </div>
        </div>
        <TransactionConfirmDialog
          open={pending !== null}
          onOpenChange={(open) => !open && setPending(null)}
          title={t('swap.review')}
          description={t('swap.confirmDescription')}
          onConfirm={confirm}
          rows={
            pending
              ? [
                  [t('swap.youPay'), fmt.token(parseAmount(pending.amount), pending.from, 6)],
                  [t('swap.youReceive'), fmt.token(out, pending.to, 6)],
                  [t('swap.minReceived'), fmt.token(minOut, pending.to, 6)],
                  [t('swap.rate'), '1 ' + pending.from + ' ≈ ' + fmt.number(rate, { maximumFractionDigits: 6 }) + ' ' + pending.to],
                  [t('swap.impact'), fmt.percent(impact, 2)],
                  [t('swap.slippage'), slippage + '%'],
                ]
              : []
          }
        />
      </WalletGate>
    </div>
  );
}
