import { useMemo } from 'react';
import { Activity, CircleCheck, CircleX, Coins, Download, FilterX, RefreshCw } from 'lucide-react';
import { createColumnHelper } from '@tanstack/react-table';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data/DataTable';
import { AddressLink } from '@/components/explorer/AddressLink';
import { TxCards } from '@/components/explorer/TxCards';
import { TxStatusBadge, TxTypeBadge } from '@/components/explorer/TxParts';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/Copy';
import { DemoBadge } from '@/components/ui/Demo';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useTransactions } from '@/hooks/useChainData';
import { useDemoTxs } from '@/hooks/useDemoTx';
import { DEMO_TX_PREFIX, isDemoTxHash } from '@/lib/demoTx';
import { useFormat } from '@/hooks/useFormat';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { downloadText, toCsv } from '@/lib/csv';
import { paths } from '@/lib/paths';
import { STATUS_FILTERS, endOfDayUtc, filterTxs, hasActiveTxFilters, parseTxFilters, txCsvRows } from '@/lib/txFilters';
import { TX_GROUPS } from '@/lib/txView';
import { shortHash } from '@/lib/utils';
import { SELECTABLE_CHAINS } from '@/services/chain/registry';
import { useChain, useChainStore } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';
import type { Tx } from '@/types/domain';

const col = createColumnHelper<Tx>();
const FETCH_LIMIT = 600;

export default function TransactionsPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const setChain = useChainStore((s) => s.setChain);
  const navigate = useNavigate();
  const compact = useMediaQuery('(max-width: 767px)');
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseTxFilters(params), [params]);
  const before = endOfDayUtc(filters.date) ?? undefined;
  const { data, isLoading, isError, refetch, isFetching } = useTransactions(FETCH_LIMIT, before);
  const now = getSimNow();
  const demoTxs = useDemoTxs();

  const setParam = (key: string, value: string): void => {
    const next = new URLSearchParams(params);
    if (value && value !== 'all') next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // transactions the Demo wallet created are part of this network's list (newest first) unless a past date is chosen
  const rows = useMemo(() => filterTxs([...(before === undefined ? demoTxs : []), ...(data ?? [])], filters), [data, demoTxs, filters, before]);
  const stats = useMemo(() => {
    const all = data ?? [];
    const failed = all.filter((x) => x.status === 'failed').length;
    return { total: all.length, failed, success: all.length - failed, rate: all.length ? (all.length - failed) / all.length : 0 };
  }, [data]);

  const exportCsv = (): void => {
    const headers = [t('common.hash'), t('txPage.block'), t('common.type'), t('common.status'), t('txPage.from'), t('txPage.to'), t('common.amount'), t('txPage.symbol'), t('common.fee'), t('txPage.feeSymbol'), t('common.time'), t('txPage.memo')];
    downloadText('chainbeat-transactions-' + chain.id + '.csv', toCsv(txCsvRows(rows, headers)));
  };

  const columns = useMemo(
    () => [
      col.accessor('hash', {
        header: t('common.hash'),
        enableSorting: false,
        cell: (c) => (
          <span className="inline-flex items-center gap-1">
            <Link to={paths.tx(c.getValue())} title={c.getValue()} className="ltr-isolate font-mono text-[12px] text-cyan hover:underline">
              {shortHash(c.getValue(), 10, 6)}
            </Link>
            <CopyButton value={c.getValue()} />
            {isDemoTxHash(c.getValue()) ? <Badge tone="yellow">{t('txPage.demoTag')}</Badge> : null}
          </span>
        ),
      }),
      col.accessor('height', {
        header: t('txPage.block'),
        cell: (c) => (
          <Link to={paths.block(c.getValue())} className="tabular-nums text-fg-2 hover:text-cyan hover:underline">
            {fmt.integer(c.getValue())}
          </Link>
        ),
      }),
      col.accessor('type', { header: t('common.type'), cell: (c) => <TxTypeBadge type={c.getValue()} /> }),
      col.accessor('from', { header: t('txPage.from'), enableSorting: false, cell: (c) => <AddressLink address={c.getValue()} at={c.row.original.height} head={8} tail={4} /> }),
      col.accessor((x) => x.to ?? '', {
        id: 'to',
        header: t('txPage.to'),
        enableSorting: false,
        cell: (c) => (c.getValue() ? <AddressLink address={c.getValue()} at={c.row.original.height} head={8} tail={4} /> : <span className="text-fg-3">—</span>),
      }),
      col.accessor('amount', { header: t('common.amount'), meta: { align: 'end' }, cell: (c) => <span className="whitespace-nowrap tabular-nums text-fg">{fmt.token(c.getValue(), c.row.original.symbol)}</span> }),
      col.accessor('feeAmount', { header: t('common.fee'), meta: { align: 'end' }, cell: (c) => <span className="whitespace-nowrap tabular-nums">{fmt.token(c.getValue(), c.row.original.feeSymbol, 5)}</span> }),
      col.accessor('time', { header: t('common.time'), meta: { align: 'end' }, cell: (c) => <span className="whitespace-nowrap tabular-nums" title={fmt.dateTime(c.getValue(), { dateStyle: 'medium', timeStyle: 'medium' })}>{fmt.relative(c.getValue(), now)}</span> }),
      col.accessor('status', { header: t('common.status'), cell: (c) => <TxStatusBadge status={c.getValue()} /> }),
    ],
    [t, fmt, now],
  );

  const active = hasActiveTxFilters(filters);
  const volume = (data ?? []).filter((x) => x.symbol === chain.symbol).reduce((a, x) => a + x.amount, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('navigation.transactions')}
        description={t('txPage.description', { chain: chain.name })}
        badge={<DemoBadge label={t('common.simulated')} />}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void refetch()} loading={isFetching && !isLoading}>
              {!isFetching ? <RefreshCw className="size-3.5" aria-hidden /> : null} {t('common.refresh')}
            </Button>
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="size-3.5" aria-hidden /> {t('common.exportCsv')}
            </Button>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Activity} label={t('txPage.stats.recent')} value={fmt.integer(stats.total)} loading={isLoading} />
        <StatCard icon={CircleCheck} label={t('txPage.stats.success')} value={fmt.integer(stats.success)} hint={fmt.percent(stats.rate, 1)} loading={isLoading} />
        <StatCard icon={CircleX} label={t('txPage.stats.failed')} value={fmt.integer(stats.failed)} loading={isLoading} />
        <StatCard icon={Coins} label={t('txPage.stats.volume')} value={fmt.tokenCompact(volume, chain.symbol)} loading={isLoading} />
      </div>
      <Panel className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3" role="search" aria-label={t('txPage.filtersLabel')}>
          <Input type="search" value={filters.q} onChange={(e) => setParam('q', e.target.value)} placeholder={t('txPage.filterPlaceholder')} aria-label={t('txPage.filterPlaceholder')} className="min-w-[200px] max-w-[320px] flex-1" />
          <Select
            aria-label={t('txPage.category')}
            className="w-[170px]"
            value={filters.group}
            onValueChange={(v) => setParam('group', v)}
            options={[{ value: 'all', label: t('txPage.allTypes') }, ...TX_GROUPS.map((g) => ({ value: g, label: t('txPage.groups.' + g) }))]}
          />
          <Segmented aria-label={t('common.status')} size="sm" value={filters.status} onChange={(v) => setParam('status', v)} options={STATUS_FILTERS.map((s) => ({ value: s, label: s === 'all' ? t('common.all') : t('txPage.status.' + s) }))} />
          <label className="flex items-center gap-2 text-[12px] text-fg-3">
            <span>{t('txPage.date')}</span>
            <Input type="date" value={filters.date} max={new Date(now).toISOString().slice(0, 10)} onChange={(e) => setParam('date', e.target.value)} aria-describedby="tx-date-hint" className="h-9 w-[150px]" />
          </label>
          <Select
            aria-label={t('txPage.network')}
            className="w-[160px]"
            value={chain.id}
            onValueChange={setChain}
            options={SELECTABLE_CHAINS.map((c) => ({ value: c.id, label: c.name }))}
          />
          {demoTxs.length > 0 ? (
            <Button variant={filters.q === DEMO_TX_PREFIX ? 'primary' : 'secondary'} size="sm" aria-pressed={filters.q === DEMO_TX_PREFIX} onClick={() => setParam('q', filters.q === DEMO_TX_PREFIX ? '' : DEMO_TX_PREFIX)}>
              {t('txPage.demoTag')} ({fmt.integer(demoTxs.length)})
            </Button>
          ) : null}
          {active ? (
            <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              <FilterX className="size-3.5" aria-hidden /> {t('common.clearFilters')}
            </Button>
          ) : null}
        </div>
        <p id="tx-date-hint" className="mb-3 text-[11.5px] text-fg-3">
          {filters.date ? t('txPage.dateNote', { count: FETCH_LIMIT, date: fmt.date(endOfDayUtc(filters.date) ?? now) }) : t('txPage.latestNote', { count: FETCH_LIMIT })}
        </p>
        {compact ? (
          <TxCards txs={rows} now={now} loading={isLoading} error={isError} onRetry={() => void refetch()} />
        ) : (
          <DataTable
            data={rows}
            columns={columns}
            caption={t('txPage.tableCaption', { chain: chain.name })}
            loading={isLoading}
            error={isError}
            onRetry={() => void refetch()}
            pageSize={15}
            pageSizes={[15, 30, 50]}
            initialSort={[{ id: 'time', desc: true }]}
            resetPageKey={JSON.stringify(filters) + chain.id}
            onRowClick={(x) => navigate(paths.tx(x.hash))}
            getRowId={(x) => x.hash}
            minWidth={1100}
            emptyTitle={t('txPage.emptyTitle')}
          />
        )}
      </Panel>
    </div>
  );
}


