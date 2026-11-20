import { useMemo } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Coins, Download, Landmark, Layers, ReceiptText, Wallet } from 'lucide-react';
import { createColumnHelper } from '@tanstack/react-table';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data/DataTable';
import { AddressLink } from '@/components/explorer/AddressLink';
import { TxStatusBadge, TxTypeBadge } from '@/components/explorer/TxParts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/Copy';
import { DemoBadge } from '@/components/ui/Demo';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { useAccount } from '@/hooks/useChainData';
import { useDemoTxs } from '@/hooks/useDemoTx';
import { usePrices } from '@/hooks/usePrices';
import { useDelegationViews } from '@/hooks/useRewards';
import { useWalletStore } from '@/stores/walletStore';
import { useFormat } from '@/hooks/useFormat';
import { downloadText, toCsv } from '@/lib/csv';
import { paths } from '@/lib/paths';
import { txCsvRows } from '@/lib/txFilters';
import { shortHash } from '@/lib/utils';
import { useChain } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';
import type { Tx } from '@/types/domain';

const col = createColumnHelper<Tx>();

export default function AccountPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const navigate = useNavigate();
  const { address = '' } = useParams();
  const [search] = useSearchParams();
  const at = Number(search.get('at')) || undefined;
  const isValidator = address.includes('valoper1');
  const wallet = useWalletStore((s) => s);
  const isDemoAccount = wallet.adapterId === 'demo' && wallet.address === address;
  const query = useAccount(isValidator || isDemoAccount ? '' : address, at);
  const { isError, refetch, isFetching } = query;
  const isLoading = query.isLoading && !isDemoAccount;
  const demoTxs = useDemoTxs();
  const { prices } = usePrices();
  const delegated = useDelegationViews(wallet.ledger.delegations);
  const now = getSimNow();

  const columns = useMemo(
    () => [
      col.accessor('hash', {
        header: t('common.hash'),
        enableSorting: false,
        cell: (c) => (
          <Link to={paths.tx(c.getValue())} title={c.getValue()} className="ltr-isolate font-mono text-[12px] text-cyan hover:underline">
            {shortHash(c.getValue(), 10, 6)}
          </Link>
        ),
      }),
      col.accessor('height', { header: t('txPage.block'), cell: (c) => <Link to={paths.block(c.getValue())} className="tabular-nums text-fg-2 hover:text-cyan hover:underline">{fmt.integer(c.getValue())}</Link> }),
      col.accessor('type', { header: t('common.type'), cell: (c) => <TxTypeBadge type={c.getValue()} /> }),
      col.display({
        id: 'direction',
        header: t('account.direction'),
        cell: (c) => {
          const out = c.row.original.from === address;
          const Icon = out ? ArrowUpRight : ArrowDownLeft;
          return (
            <Badge tone={out ? 'neutral' : 'cyan'} className="gap-1">
              <Icon className="size-3" aria-hidden /> {t(out ? 'account.out' : 'account.in')}
            </Badge>
          );
        },
      }),
      col.display({
        id: 'counterparty',
        header: t('account.counterparty'),
        cell: (c) => {
          const x = c.row.original;
          const other = x.from === address ? x.to : x.from;
          return other ? <AddressLink address={other} at={x.height} head={8} tail={4} /> : <span className="text-fg-3">—</span>;
        },
      }),
      col.accessor('amount', { header: t('common.amount'), meta: { align: 'end' }, cell: (c) => <span className="whitespace-nowrap tabular-nums text-fg">{fmt.token(c.getValue(), c.row.original.symbol)}</span> }),
      col.accessor('time', { header: t('common.time'), meta: { align: 'end' }, cell: (c) => <span className="whitespace-nowrap tabular-nums" title={fmt.dateTime(c.getValue(), { dateStyle: 'medium', timeStyle: 'medium' })}>{fmt.relative(c.getValue(), now)}</span> }),
      col.accessor('status', { header: t('common.status'), cell: (c) => <TxStatusBadge status={c.getValue()} /> }),
    ],
    [t, fmt, now, address],
  );

  const demoAccount = useMemo(() => {
    if (!isDemoAccount) return undefined;
    const balances = Object.entries(wallet.ledger.balances)
      .filter(([, amount]) => amount > 0)
      .map(([symbol, amount]) => ({ symbol, amount, usd: amount * (prices[symbol] ?? 0) }));
    const staked = wallet.ledger.delegations.filter((d) => d.chainId === chain.id).reduce((a, d) => a + d.amount, 0);
    return {
      address,
      chainId: chain.id,
      kind: 'demo' as const,
      label: t('wallet.demoWallet'),
      balances,
      staked,
      rewards: 0,
      totalValueUsd: balances.reduce((a, b) => a + b.usd, 0) + delegated.stakedUsd + delegated.rewardsUsd,
      txCount: demoTxs.length,
      windowBlocks: 0,
    };
  }, [isDemoAccount, wallet.ledger, prices, chain.id, address, t, delegated.stakedUsd, delegated.rewardsUsd, demoTxs.length]);
  const account = demoAccount ?? query.data?.account;
  const txs = isDemoAccount ? demoTxs : (query.data?.txs ?? []);
  const native = account?.balances.find((b) => b.symbol === chain.symbol)?.amount ?? 0;
  const exportCsv = (): void => {
    const headers = [t('common.hash'), t('txPage.block'), t('common.type'), t('common.status'), t('txPage.from'), t('txPage.to'), t('common.amount'), t('txPage.symbol'), t('common.fee'), t('txPage.feeSymbol'), t('common.time'), t('txPage.memo')];
    downloadText('chainbeat-account-' + shortHash(address, 8, 4) + '.csv', toCsv(txCsvRows(txs, headers)));
  };

  if (isValidator) return <Navigate to={paths.validator(address)} replace />;
  return (
    <div className="space-y-4">
      <PageHeader
        title={t('account.title')}
        description={t('account.description', { chain: chain.name })}
        badge={<DemoBadge label={t('common.simulated')} />}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to={paths.explorer}>
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t('navigation.explorerHome')}
            </Link>
          </Button>
        }
      />
      <Panel className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Wallet className="size-4 text-fg-3" aria-hidden />
          <span dir="ltr" className="ltr-isolate break-all font-mono text-[13px] text-fg">{address}</span>
          <CopyButton value={address} label={t('wallet.copyAddress')} />
        </div>
        {account?.kind === 'unknown' ? <p className="mt-2 text-[12.5px] text-fg-3">{t('account.unknown')}</p> : null}
        {account?.kind === 'demo' ? <p className="mt-2 text-[12.5px] text-fg-3">{t('account.demoWallet')}</p> : null}
      </Panel>

      {isLoading ? (
        <Skeleton className="h-[260px] rounded-2xl" />
      ) : isError ? (
        <Panel>
          <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
        </Panel>
      ) : !account ? (
        <Panel>
          <EmptyState title={t('account.invalidTitle')} description={t('account.invalidBody', { chain: chain.name, prefix: chain.bech32Prefix })} action={<Button asChild variant="primary"><Link to={paths.explorer}>{t('navigation.explorerHome')}</Link></Button>} />
        </Panel>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Landmark} label={t('account.totalValue')} value={fmt.usdCompact(account.totalValueUsd)} />
            <StatCard icon={Coins} label={t('account.available')} value={fmt.token(native, chain.symbol, 2)} />
            <StatCard icon={Layers} label={t('account.staked')} value={fmt.token(account.staked, chain.symbol, 2)} hint={t('account.rewards', { value: fmt.token(account.rewards, chain.symbol, 4) })} />
            <StatCard icon={ReceiptText} label={t('account.txCount')} value={fmt.integer(account.txCount)} hint={t('account.window', { blocks: fmt.integer(account.windowBlocks) })} />
          </div>
          <Panel className="p-4">
            <h2 className="mb-3 font-display text-[15px] font-semibold">{t('account.balances')}</h2>
            {account.balances.length === 0 ? (
              <p className="text-[12.5px] text-fg-3">{t('account.noBalances')}</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-[12.5px]">
                  <caption className="sr-only">{t('account.balances')}</caption>
                  <thead className="bg-card/60 text-[10.5px] uppercase tracking-wider text-fg-3">
                    <tr>
                      <th scope="col" className="px-3 py-2.5 text-start font-semibold">{t('txPage.token')}</th>
                      <th scope="col" className="px-3 py-2.5 text-end font-semibold">{t('common.amount')}</th>
                      <th scope="col" className="px-3 py-2.5 text-end font-semibold">{t('portfolio.value')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.balances.map((b) => (
                      <tr key={b.symbol} className="border-t border-line">
                        <th scope="row" className="px-3 py-2.5 text-start font-medium text-fg">{b.symbol}</th>
                        <td className="px-3 py-2.5 text-end tabular-nums">{fmt.token(b.amount, b.symbol, 2)}</td>
                        <td className="px-3 py-2.5 text-end tabular-nums">{fmt.currency(b.usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <Panel className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-[15px] font-semibold">{t('account.history')}</h2>
              <Button variant="secondary" size="sm" onClick={exportCsv} disabled={txs.length === 0}>
                <Download className="size-3.5" aria-hidden /> {t('common.exportCsv')}
              </Button>
            </div>
            <DataTable
              data={txs}
              columns={columns}
              caption={t('account.historyCaption', { address: shortHash(address, 10, 6) })}
              pageSize={10}
              initialSort={[{ id: 'time', desc: true }]}
              onRowClick={(x) => navigate(paths.tx(x.hash))}
              getRowId={(x) => x.hash}
              minWidth={980}
              emptyTitle={t('account.noHistory')}
              emptyBody={t('account.noHistoryBody', { blocks: fmt.integer(account.windowBlocks) })}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
