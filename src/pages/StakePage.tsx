import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { DemoBadge, DemoNotice } from '@/components/ui/Demo';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Field, Input, fieldAria } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { ActivityList } from '@/components/wallet/ActivityList';
import { AmountField } from '@/components/wallet/AmountField';
import { TransactionConfirmDialog } from '@/components/wallet/ConfirmDialog';
import { WalletGate } from '@/components/wallet/WalletGate';
import { useMetrics, useValidators } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { useDelegationViews } from '@/hooks/useRewards';
import { makeDemoTx } from '@/lib/demoTx';
import { uid } from '@/lib/utils';
import { countDecimals, floorTo, parseAmount } from '@/lib/validation';
import { useChain } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';
import { toast } from '@/stores/toastStore';
import { useWalletStore } from '@/stores/walletStore';

interface StakeForm {
  validator: string;
  amount: string;
}

export default function StakePage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const [params] = useSearchParams();
  const validators = useValidators();
  const metrics = useMetrics().data;
  const balance = useWalletStore((s) => s.ledger.balances[chain.symbol] ?? 0);
  const delegations = useWalletStore((s) => s.ledger.delegations);
  const { views } = useDelegationViews(delegations);
  const mine = views.filter((v) => v.chainId === chain.id);
  const address = useWalletStore((s) => s.address);
  const claims = useWalletStore((s) => s.ledger.activity).filter((a) => a.kind === 'claim');
  const [pending, setPending] = useState<StakeForm | null>(null);
  const [unstaking, setUnstaking] = useState<(typeof mine)[number] | null>(null);
  const [unstakeAmount, setUnstakeAmount] = useState('');

  const active = useMemo(() => (validators.data ?? []).filter((v) => v.status === 'active'), [validators.data]);

  const schema = useMemo(
    () =>
      z
        .object({ validator: z.string().min(1, t('stake.errors.validator')), amount: z.string() })
        .superRefine((v, ctx) => {
          const n = parseAmount(v.amount);
          if (!Number.isFinite(n) || n <= 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: t('swap.errors.amountInvalid') });
          else if (countDecimals(v.amount) > chain.decimals) ctx.addIssue({ code: 'custom', path: ['amount'], message: t('send.errors.precision', { symbol: chain.symbol, digits: chain.decimals }) });
          else if (n > balance) ctx.addIssue({ code: 'custom', path: ['amount'], message: t('swap.errors.insufficient', { symbol: chain.symbol }) });
        }),
    [t, balance, chain.symbol, chain.decimals],
  );

  const form = useForm<StakeForm>({ resolver: zodResolver(schema), mode: 'onChange', defaultValues: { validator: '', amount: '' } });
  const { register, watch, setValue, handleSubmit, formState } = form;
  const values = watch();

  // Preselect from ?validator=… (set by the validators page) or default to the top validator.
  useEffect(() => {
    if (active.length === 0 || values.validator) return;
    const wanted = params.get('validator');
    const target = active.find((v) => v.operatorAddress === wanted) ?? active[0];
    if (target) setValue('validator', target.operatorAddress, { shouldValidate: true });
  }, [active, params, setValue, values.validator]);

  const picked = active.find((v) => v.operatorAddress === values.validator);
  const amount = parseAmount(values.amount);
  const valid = Number.isFinite(amount) && amount > 0;
  const netApr = metrics ? metrics.stakingApr * (1 - (picked?.commission ?? 0)) : 0;
  const yearly = valid ? amount * netApr : 0;

  // step 1: validate, then ask for confirmation — nothing changes yet
  const onSubmit = handleSubmit((v) => setPending(v));

  // step 2: confirmed — delegate in the Demo ledger and create the synthetic transaction
  const confirm = (): void => {
    if (!pending || !address) return;
    const n = parseAmount(pending.amount);
    const target = active.find((x) => x.operatorAddress === pending.validator);
    if (!target) return;
    const store = useWalletStore.getState();
    const tx = makeDemoTx(chain, getSimNow(), { type: 'delegate', from: address, to: target.operatorAddress, amount: n, symbol: chain.symbol, seed: uid('stake') });
    store.adjustBalance(chain.symbol, -n);
    store.addDelegation({ chainId: chain.id, validator: target.operatorAddress, moniker: target.moniker, amount: n });
    store.recordTx('stake', { amountAmt: n, symbol: chain.symbol, validator: target.moniker }, tx);
    toast.success(t('stake.done'), t('stake.doneBody', { days: chain.unbondingDays }));
    form.reset({ validator: pending.validator, amount: '' });
    setPending(null);
  };

  const unstakeValue = parseAmount(unstakeAmount);
  const unstakeError = unstaking
    ? !Number.isFinite(unstakeValue) || unstakeValue <= 0
      ? t('swap.errors.amountInvalid')
      : unstakeValue > unstaking.amount + 1e-9
        ? t('stake.errors.moreThanStaked')
        : undefined
    : undefined;

  const confirmUnstake = (): void => {
    if (!unstaking || unstakeError || !Number.isFinite(unstakeValue)) return;
    if (!address) return;
    const store = useWalletStore.getState();
    const n = Math.min(unstakeValue, unstaking.amount);
    const tx = makeDemoTx(chain, getSimNow(), { type: 'undelegate', from: address, to: unstaking.validator, amount: n, symbol: chain.symbol, seed: uid('unstake') });
    store.removeDelegation(unstaking.chainId, unstaking.validator, n);
    store.adjustBalance(chain.symbol, n);
    store.recordTx('unstake', { amountAmt: n, symbol: chain.symbol, validator: unstaking.moniker }, tx);
    toast.success(t('stake.unstaked'), t('stake.unstakedBody', { days: chain.unbondingDays }));
    setUnstaking(null);
    setUnstakeAmount('');
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.stake')} description={t('stake.description', { chain: chain.name })} badge={<DemoBadge label={t('common.simulated')} />} />
      <WalletGate>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Panel className="p-5">
              <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={t('navigation.stake')}>
                <Field label={t('stake.validator')} htmlFor="stake-validator" error={formState.errors.validator?.message}>
                  <Select
                    id="stake-validator"
                    aria-label={t('stake.validator')}
                    value={values.validator}
                    onValueChange={(v) => setValue('validator', v, { shouldValidate: true })}
                    placeholder={t('stake.pickValidator')}
                    options={active.slice(0, 60).map((v) => ({ value: v.operatorAddress, label: `${v.moniker} · ${fmt.percent(v.commission, 1)}` }))}
                    invalid={Boolean(formState.errors.validator)}
                  />
                </Field>
                <AmountField
                  id="stake-amount"
                  label={t('common.amount')}
                  register={register('amount')}
                  error={formState.errors.amount?.message}
                  balance={balance}
                  symbol={chain.symbol}
                  onMax={() => setValue('amount', String(floorTo(balance, 6)), { shouldValidate: true })}
                  trailing={chain.symbol}
                />
                <dl className="divide-y divide-line rounded-xl border border-line bg-card/40 text-[12.5px]" aria-label={t('stake.estimate')}>
                  {[
                    [t('stake.netApr'), metrics ? fmt.percent(netApr, 2) : '—'],
                    [t('stake.yearly'), valid ? fmt.token(yearly, chain.symbol, 4) : '—'],
                    [t('stake.monthly'), valid ? fmt.token(yearly / 12, chain.symbol, 4) : '—'],
                    [t('stake.unbonding'), fmt.days(chain.unbondingDays)],
                    [t('stake.commission'), picked ? fmt.percent(picked.commission, 1) : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 px-3 py-2">
                      <dt className="text-fg-3">{k}</dt>
                      <dd className="font-medium tabular-nums text-fg">{v}</dd>
                    </div>
                  ))}
                </dl>
                <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!formState.isValid}>
                  {t('stake.review')}
                </Button>
                <p className="text-[11.5px] leading-relaxed text-fg-3">{t('stake.aprDisclaimer')}</p>
                <DemoNotice>{t('stake.notice', { days: chain.unbondingDays })}</DemoNotice>
              </form>
            </Panel>

            <Panel className="p-4">
              <h2 className="mb-2 font-display text-[15px] font-semibold">{t('stake.yourStake', { chain: chain.name })}</h2>
              {mine.length === 0 ? (
                <p className="py-5 text-center text-[12.5px] text-fg-3">{t('portfolio.noDelegations')}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {mine.map((v) => (
                    <li key={v.validator} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-fg">{v.moniker}</span>
                        <span className="block text-[11.5px] tabular-nums text-green">+{fmt.token(v.rewards, v.symbol, 6)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-[13px] font-medium tabular-nums text-fg">{fmt.token(v.amount, v.symbol)}</span>
                        <Button size="sm" variant="secondary" onClick={() => { setUnstaking(v); setUnstakeAmount(String(v.amount)); }}>
                          {t('stake.unstake')}
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
          <div className="space-y-4">
            <Panel className="p-4">
              <h2 className="mb-1 font-display text-[15px] font-semibold">{t('wallet.activity.title')}</h2>
              <ActivityList />
            </Panel>
            <Panel className="p-4">
              <h2 className="mb-1 font-display text-[15px] font-semibold">{t('stake.rewardsHistory')}</h2>
              {claims.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-fg-3">{t('stake.noRewardsHistory')}</p>
              ) : (
                <ul className="divide-y divide-line text-[12.5px]">
                  {claims.slice(0, 6).map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-fg-2">{t('stake.rewardsClaimed', { amount: fmt.number(Number(a.params.amountAmt ?? 0), { maximumFractionDigits: 2 }), symbol: String(a.params.symbol ?? '') })}</span>
                      <span className="text-fg-3">{fmt.relative(a.ts)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
        <TransactionConfirmDialog
          open={pending !== null}
          onOpenChange={(open) => !open && setPending(null)}
          title={t('stake.review')}
          description={t('stake.confirmDescription')}
          onConfirm={confirm}
          rows={
            pending
              ? [
                  [t('wallet.confirm.network'), chain.name],
                  [t('stake.validator'), active.find((v) => v.operatorAddress === pending.validator)?.moniker ?? ''],
                  [t('common.amount'), fmt.token(parseAmount(pending.amount), chain.symbol, 6)],
                  [t('stake.netApr'), fmt.percent(netApr, 2)],
                  [t('stake.unbonding'), fmt.days(chain.unbondingDays)],
                ]
              : []
          }
        />
      </WalletGate>

      <Dialog open={unstaking !== null} onOpenChange={(open) => !open && setUnstaking(null)}>
        {unstaking ? (
          <DialogContent title={t('stake.unstakeTitle', { validator: unstaking.moniker })} description={t('stake.unstakeDescription', { days: chain.unbondingDays })} size="sm">
            <div className="space-y-4">
              <Field label={t('common.amount')} htmlFor="unstake-amount" error={unstakeError}>
                <Input {...fieldAria('unstake-amount', unstakeError)} inputMode="decimal" value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)} autoComplete="off" />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setUnstaking(null)}>
                  {t('common.cancel')}
                </Button>
                <Button variant="primary" disabled={Boolean(unstakeError)} onClick={confirmUnstake}>
                  {t('stake.confirmUnstake')}
                </Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
