import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { DemoBadge, DemoNotice } from '@/components/ui/Demo';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { ActivityList } from '@/components/wallet/ActivityList';
import { AmountField } from '@/components/wallet/AmountField';
import { TransactionConfirmDialog } from '@/components/wallet/ConfirmDialog';
import { WalletGate } from '@/components/wallet/WalletGate';
import { useMultichain } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { usePrices } from '@/hooks/usePrices';
import { makeDemoTx } from '@/lib/demoTx';
import { uid } from '@/lib/utils';
import { floorTo, parseAmount } from '@/lib/validation';
import { useChain } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';
import { toast } from '@/stores/toastStore';
import { useWalletStore } from '@/stores/walletStore';

type Base = 'ATOM' | 'OSMO';
type Mode = 'stake' | 'unstake';
const PROTOCOL_FEE = 0.05; // share of staking rewards kept by the (simulated) protocol
const MINT_FEE = 0.001;

interface LiquidForm {
  amount: string;
}

export default function LiquidStakingPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const { prices } = usePrices();
  const multichain = useMultichain().data;
  const balances = useWalletStore((s) => s.ledger.balances);
  const chain = useChain();
  const address = useWalletStore((s) => s.address);
  const [pending, setPending] = useState<LiquidForm | null>(null);
  const [base, setBase] = useState<Base>('ATOM');
  const [mode, setMode] = useState<Mode>('stake');

  const liquid = `st${base}`;
  const from = mode === 'stake' ? base : liquid;
  const to = mode === 'stake' ? liquid : base;
  const balance = balances[from] ?? 0;
  /** 1 stX is worth this many X, and keeps growing as rewards accrue. */
  const ratio = prices[base] ? (prices[liquid] ?? 0) / (prices[base] as number) : 1;
  const apr = (multichain?.find((r) => r.symbol === base)?.stakingApr ?? 0) * (1 - PROTOCOL_FEE);

  const schema = useMemo(
    () =>
      z.object({ amount: z.string() }).superRefine((v, ctx) => {
        const n = parseAmount(v.amount);
        if (!Number.isFinite(n) || n <= 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: t('swap.errors.amountInvalid') });
        else if (n > balance) ctx.addIssue({ code: 'custom', path: ['amount'], message: t('swap.errors.insufficient', { symbol: from }) });
      }),
    [t, balance, from],
  );
  const form = useForm<LiquidForm>({ resolver: zodResolver(schema), mode: 'onChange', defaultValues: { amount: '' } });
  const { register, watch, setValue, handleSubmit, formState, reset, trigger } = form;
  const amount = parseAmount(watch('amount'));
  const valid = Number.isFinite(amount) && amount > 0;
  const received = valid ? (mode === 'stake' ? amount / ratio : amount * ratio) * (1 - MINT_FEE) : 0;

  // step 1: validate, then ask for confirmation — nothing changes yet
  const onSubmit = handleSubmit((v) => setPending(v));

  // step 2: confirmed — convert in the Demo ledger and create the synthetic transaction
  const confirm = (): void => {
    if (!pending || !address) return;
    const n = parseAmount(pending.amount);
    const store = useWalletStore.getState();
    const tx = makeDemoTx(chain, getSimNow(), { type: 'swap', from: address, amount: n, symbol: from, memo: 'liquid staking (simulated)', seed: uid('liquid') });
    store.adjustBalance(from, -n);
    store.adjustBalance(to, received);
    store.recordTx('liquid-stake', { mode, amountInAmt: n, from, amountOutAmt: received, to }, tx);
    toast.success(t('liquid.done'), t('liquid.doneBody'));
    reset({ amount: '' });
    setPending(null);
  };

  const changeMode = (next: Mode): void => {
    setMode(next);
    reset({ amount: '' });
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.liquidStaking')} description={t('liquid.description')} badge={<DemoBadge label={t('common.simulated')} />} />
      <WalletGate>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <Segmented aria-label={t('liquid.mode')} value={mode} onChange={changeMode} options={[{ value: 'stake', label: t('liquid.stake') }, { value: 'unstake', label: t('liquid.unstake') }]} />
              <Segmented
                aria-label={t('liquid.asset')}
                value={base}
                onChange={(v) => {
                  setBase(v);
                  reset({ amount: '' });
                  void trigger();
                }}
                options={[{ value: 'ATOM', label: 'ATOM' }, { value: 'OSMO', label: 'OSMO' }]}
              />
            </div>
            <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={t('navigation.liquidStaking')}>
              <AmountField
                id="liquid-amount"
                label={mode === 'stake' ? t('liquid.youStake', { symbol: from }) : t('liquid.youRedeem', { symbol: from })}
                register={register('amount')}
                error={formState.errors.amount?.message}
                balance={balance}
                symbol={from}
                onMax={() => setValue('amount', String(floorTo(balance, 6)), { shouldValidate: true })}
                trailing={from}
              />
              <AmountField id="liquid-out" label={t('liquid.youReceive', { symbol: to })} readOnly value={valid ? fmt.number(received, { maximumFractionDigits: 6 }) : ''} trailing={to} />
              <dl className="divide-y divide-line rounded-xl border border-line bg-card/40 text-[12.5px]" aria-label={t('swap.quote')}>
                {[
                  [t('liquid.exchangeRate'), `1 ${liquid} = ${fmt.number(ratio, { maximumFractionDigits: 4 })} ${base}`],
                  [t('liquid.apr'), multichain ? fmt.percent(apr, 2) : '—'],
                  [t('liquid.protocolFee'), fmt.percent(PROTOCOL_FEE, 0)],
                  [t('swap.fee'), fmt.percent(MINT_FEE, 2)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 px-3 py-2">
                    <dt className="text-fg-3">{k}</dt>
                    <dd className="font-medium tabular-nums text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!formState.isValid}>
                {t('liquid.review')}
              </Button>
              <DemoNotice>{t('liquid.notice')}</DemoNotice>
              <p className="text-[12px] leading-relaxed text-fg-3">{t('liquid.rateExplain')}</p>
            </form>
          </Panel>
          <div className="space-y-4">
            <Panel className="p-4">
              <h2 className="mb-2 font-display text-[15px] font-semibold">{t('liquid.risksTitle')}</h2>
              <ul className="list-disc space-y-1.5 ps-5 text-[12.5px] leading-relaxed text-fg-2">
                {(['smartContract', 'depeg', 'validator', 'unbonding'] as const).map((r) => (
                  <li key={r}>{t('liquid.risks.' + r)}</li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] leading-relaxed text-fg-3">{t('liquid.noProtocol')}</p>
            </Panel>
            <Panel className="p-4">
              <h2 className="mb-1 font-display text-[15px] font-semibold">{t('wallet.activity.title')}</h2>
              <ActivityList />
            </Panel>
          </div>
        </div>
        <TransactionConfirmDialog
          open={pending !== null}
          onOpenChange={(open) => !open && setPending(null)}
          title={t('liquid.review')}
          description={t('liquid.confirmDescription')}
          onConfirm={confirm}
          rows={
            pending
              ? [
                  [mode === 'stake' ? t('liquid.youStake', { symbol: from }) : t('liquid.youRedeem', { symbol: from }), fmt.token(parseAmount(pending.amount), from, 6)],
                  [t('liquid.youReceive', { symbol: to }), fmt.token(received, to, 6)],
                  [t('liquid.exchangeRate'), '1 ' + liquid + ' = ' + fmt.number(ratio, { maximumFractionDigits: 4 }) + ' ' + base],
                  [t('liquid.protocolFee'), fmt.percent(PROTOCOL_FEE, 0)],
                ]
              : []
          }
        />
      </WalletGate>
    </div>
  );
}
