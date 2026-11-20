import { useMemo } from 'react';
import { Gift, Layers, PieChart as PieIcon, Wallet } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { createColumnHelper } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { HistoryChart } from '@/components/charts/HistoryChart';
import { TxTypeBadge } from '@/components/explorer/TxParts';
import { DataTable } from '@/components/data/DataTable';
import { Button } from '@/components/ui/Button';
import { Hash } from '@/components/ui/Copy';
import { DemoBadge, DemoNotice } from '@/components/ui/Demo';
import { EmptyState } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { ActivityList } from '@/components/wallet/ActivityList';
import { WalletGate, useConnectDemo, useWalletState } from '@/components/wallet/WalletGate';
import { useDemoTxs } from '@/hooks/useDemoTx';
import { usePortfolioHistory } from '@/hooks/usePortfolioHistory';
import { useDelegationViews } from '@/hooks/useRewards';
import { useFormat } from '@/hooks/useFormat';
import { usePrices } from '@/hooks/usePrices';
import { paths } from '@/lib/paths';
import { shortHash } from '@/lib/utils';
import { getAsset } from '@/services/chain/registry';
import { useChain } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';
import { toast } from '@/stores/toastStore';
import { useWalletStore } from '@/stores/walletStore';

interface AssetRow {
  symbol: string;
  name: string;
  balance: number;
  price: number;
  value: number;
}
const col = createColumnHelper<AssetRow>();
const SLICE_COLORS = ['var(--c-purple)', 'var(--c-cyan)', 'var(--c-yellow)', 'var(--c-blue)', 'var(--c-green)', 'var(--c-amber)', 'var(--c-red)'];

export default function PortfolioPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const { connected, isDemo, address } = useWalletState();
  const connectDemo = useConnectDemo();
  const ledger = useWalletStore((s) => s.ledger);
  const { prices } = usePrices();
  const { views, rewardsUsd, stakedUsd } = useDelegationViews(ledger.delegations);
  const chain = useChain();
  const demoTxs = useDemoTxs();
  const holdings = useMemo(() => {
    const h: Record<string, number> = { ...ledger.balances };
    for (const d of ledger.delegations) h[chain.symbol] = (h[chain.symbol] ?? 0) + d.amount;
    return h;
  }, [ledger.balances, ledger.delegations, chain.symbol]);
  const history = usePortfolioHistory(holdings);

  const assets = useMemo<AssetRow[]>(
    () =>
      Object.entries(ledger.balances)
        .filter(([, balance]) => balance > 0)
        .map(([symbol, balance]) => ({ symbol, name: getAsset(symbol).name, balance, price: prices[symbol] ?? 0, value: balance * (prices[symbol] ?? 0) })),
    [ledger.balances, prices],
  );
  const liquidUsd = assets.reduce((a, r) => a + r.value, 0);
  const total = liquidUsd + stakedUsd + rewardsUsd;

  const slices = useMemo(() => {
    const base = assets.map((a) => ({ name: a.symbol, value: a.value }));
    return stakedUsd > 0 ? [...base, { name: t('portfolio.staked'), value: stakedUsd }] : base;
  }, [assets, stakedUsd, t]);

  const columns = useMemo(
    () => [
      col.accessor('symbol', {
        header: t('tokens.col.token'),
        cell: ({ row }) => (
          <span className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-full text-[10px] font-bold text-[var(--c-canvas)]" style={{ background: `var(--c-${getAsset(row.original.symbol).color})` }} aria-hidden>
              {row.original.symbol.slice(0, 2)}
            </span>
            <span>
              <span className="block font-semibold text-fg">{row.original.symbol}</span>
              <span className="block text-[11px] text-fg-3">{row.original.name}</span>
            </span>
          </span>
        ),
      }),
      col.accessor('balance', { header: t('common.balance'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums text-fg">{fmt.number(c.getValue(), { maximumFractionDigits: 6 })}</span> }),
      col.accessor('price', { header: t('tokens.col.price'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums">{fmt.currency(c.getValue(), 'USD', { maximumFractionDigits: c.getValue() < 1 ? 4 : 2 })}</span> }),
      col.accessor('value', { header: t('portfolio.value'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums text-fg">{fmt.currency(c.getValue())}</span> }),
      col.display({ id: 'share', header: t('portfolio.share'), meta: { align: 'end' }, cell: ({ row }) => <span className="tabular-nums">{fmt.percent(total ? row.original.value / total : 0, 1)}</span> }),
    ],
    [t, fmt, total],
  );

  const claim = (): void => {
    if (views.length === 0) return;
    const now = getSimNow();
    const store = useWalletStore.getState();
    const lines: string[] = [];
    for (const v of views) {
      if (v.rewards <= 0 || !v.symbol) continue;
      store.adjustBalance(v.symbol, v.rewards);
      lines.push(`${fmt.number(v.rewards, { maximumFractionDigits: 6 })} ${v.symbol}`);
    }
    store.resetRewardClock(now);
    store.record('claim', { amountAmt: Number(rewardsUsd.toFixed(2)), symbol: 'USD' });
    toast.success(t('portfolio.claimed'), lines.join(' · '));
  };

  // A real extension wallet is connected: be explicit that Demo Mode does not read real balances.
  if (connected && !isDemo) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('navigation.portfolio')} description={t('portfolio.description')} />
        <Panel className="p-5">
          <div className="flex items-start gap-3">
            <span className="icon-tile size-10">
              <Wallet className="size-5 text-cyan" aria-hidden />
            </span>
            <div className="min-w-0 space-y-2">
              <p className="font-display text-[15px] font-semibold">{t('portfolio.realTitle')}</p>
              {address ? <Hash value={address} head={14} tail={8} /> : null}
              <p className="max-w-[60ch] text-[13px] leading-relaxed text-fg-2">{t('portfolio.realBody')}</p>
              <Button variant="primary" onClick={() => void connectDemo()}>
                {t('gate.useDemo')}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.portfolio')} description={t('portfolio.description')} badge={<DemoBadge label={t('common.simulated')} />} />
      <WalletGate>
        <div className="space-y-4">
          <DemoNotice />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Wallet} label={t('portfolio.totalValue')} value={fmt.currency(total)} hint={t('portfolio.network') + ': ' + chain.name} />
            <StatCard icon={PieIcon} label={t('portfolio.available')} value={fmt.currency(liquidUsd)} hint={t('portfolio.liquid')} />
            <StatCard icon={Layers} label={t('portfolio.delegated')} value={fmt.currency(stakedUsd)} hint={t('portfolio.staked')} />
            <StatCard icon={Gift} label={t('portfolio.rewards')} value={fmt.currency(rewardsUsd)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel className="p-4">
              <h2 className="mb-3 font-display text-[15px] font-semibold">{t('portfolio.assets')}</h2>
              <DataTable data={assets} columns={columns} caption={t('portfolio.assetsCaption')} pageSize={8} initialSort={[{ id: 'value', desc: true }]} getRowId={(r) => r.symbol} minWidth={560} emptyTitle={t('portfolio.noAssets')} />
            </Panel>
            <Panel className="p-4">
              <h2 className="mb-1 font-display text-[15px] font-semibold">{t('portfolio.allocation')}</h2>
              <div className="h-[230px]" dir="ltr">
                {slices.length === 0 ? (
                  <EmptyState title={t('portfolio.noAssets')} description=" " />
                ) : (
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 230 }}>
                    <PieChart>
                      <Pie data={slices} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                        {slices.map((s, i) => (
                          <Cell key={s.name} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip content={<ChartTooltip valueFormatter={(v) => fmt.currency(Number(v))} />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-fg-2">
                {slices.map((s, i) => (
                  <li key={s.name} className="inline-flex items-center gap-1.5">
                    <i className="size-2 rounded-full" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                    {s.name} <span className="tabular-nums text-fg-3">{fmt.percent(total ? s.value / total : 0, 0)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel className="p-4">
            <h2 className="font-display text-[15px] font-semibold">{t('portfolio.history')}</h2>
            <p className="mb-2 mt-0.5 text-[12px] text-fg-3">{t('portfolio.historyNote')}</p>
            <div role="img" aria-label={t('portfolio.historyLabel')}>
              <HistoryChart data={history.data} name={t('portfolio.totalValue')} format={(v) => fmt.currency(v, 'USD', { maximumFractionDigits: 0 })} color="var(--c-purple)" height={200} />
            </div>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-[15px] font-semibold">{t('portfolio.delegations')}</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={claim} disabled={rewardsUsd <= 0}>
                    {t('portfolio.claim')}
                  </Button>
                  <Button size="sm" asChild>
                    <Link to="/wallet/stake">{t('navigation.stake')}</Link>
                  </Button>
                </div>
              </div>
              {views.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-fg-3">{t('portfolio.noDelegations')}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {views.map((v) => (
                    <li key={`${v.chainId}:${v.validator}`} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-fg">{v.moniker}</span>
                        <span className="block text-[11.5px] text-fg-3">{v.chainName}</span>
                      </span>
                      <span className="text-end">
                        <span className="block text-[13px] font-medium tabular-nums text-fg">{fmt.token(v.amount, v.symbol)}</span>
                        <span className="block text-[11.5px] tabular-nums text-green">+{fmt.token(v.rewards, v.symbol, 6)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <div className="space-y-4">
              <Panel className="p-4">
                <h2 className="mb-2 font-display text-[15px] font-semibold">{t('portfolio.recentTx')}</h2>
                {demoTxs.length === 0 ? (
                  <p className="py-4 text-center text-[12.5px] text-fg-3">{t('portfolio.noRecentTx')}</p>
                ) : (
                  <ul className="divide-y divide-line text-[12.5px]">
                    {demoTxs.slice(0, 5).map((x) => (
                      <li key={x.hash} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                        <Link to={paths.tx(x.hash)} title={x.hash} className="ltr-isolate font-mono text-[12px] text-cyan hover:underline">
                          {shortHash(x.hash, 8, 4)}
                        </Link>
                        <TxTypeBadge type={x.type} />
                        <span className="ms-auto tabular-nums text-fg">{fmt.token(x.amount, x.symbol)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel className="p-4">
                <h2 className="mb-2 font-display text-[15px] font-semibold">{t('wallet.activity.title')}</h2>
                <ActivityList />
              </Panel>
            </div>
          </div>
        </div>
      </WalletGate>
    </div>
  );
}
