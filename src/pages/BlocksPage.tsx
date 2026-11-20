import { useMemo } from 'react';
import { Boxes, CircleCheck, FilterX, Gauge, Layers, Timer } from 'lucide-react';
import { createColumnHelper } from '@tanstack/react-table';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Hash } from '@/components/ui/Copy';
import { DemoBadge } from '@/components/ui/Demo';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { Switch } from '@/components/ui/Switch';
import { useBlocks, useMetrics } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { paths } from '@/lib/paths';
import { SELECTABLE_CHAINS } from '@/services/chain/registry';
import { useChain, useChainStore } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';
import type { Block } from '@/types/domain';

const col = createColumnHelper<Block>();

/** Live-updating (simulated) list of the newest blocks, with search and filters. */
export default function BlocksPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const setChain = useChainStore((s) => s.setChain);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const withTxs = params.get('txs') === '1';
  const { data, isLoading, isError, refetch } = useBlocks(150);
  const metrics = useMetrics().data;
  const now = getSimNow();

  const setParam = (key: string, value: string): void => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter(
      (b) =>
        (!withTxs || b.txCount > 0) &&
        (!needle || String(b.height) === needle || b.hash.toLowerCase().includes(needle) || b.proposer.moniker.toLowerCase().includes(needle) || b.proposer.address.toLowerCase().includes(needle)),
    );
  }, [data, q, withTxs]);

  const columns = useMemo(
    () => [
      col.accessor('height', {
        header: t('common.height'),
        cell: (c) => (
          <Link to={paths.block(c.getValue())} className="font-medium tabular-nums text-cyan hover:underline">
            {fmt.integer(c.getValue())}
          </Link>
        ),
      }),
      col.accessor('hash', { header: t('common.hash'), enableSorting: false, cell: (c) => <Hash value={c.getValue()} head={10} tail={6} /> }),
      col.accessor('time', {
        header: t('common.time'),
        cell: (c) => (
          <span title={fmt.dateTime(c.getValue(), { dateStyle: 'medium', timeStyle: 'medium' })} className="whitespace-nowrap tabular-nums">
            {fmt.relative(c.getValue(), now)}
          </span>
        ),
      }),
      col.accessor((b) => b.proposer.moniker, {
        id: 'proposer',
        header: t('blocksPage.proposer'),
        cell: (c) => (
          <Link to={paths.validator(c.row.original.proposer.address)} className="text-fg hover:text-cyan hover:underline">
            {c.getValue()}
          </Link>
        ),
      }),
      col.accessor('txCount', { header: t('blocksPage.txs'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums text-fg">{fmt.integer(c.getValue())}</span> }),
      col.accessor((b) => b.gasUsed / b.gasLimit, {
        id: 'gas',
        header: t('blocksPage.gas'),
        meta: { align: 'end' },
        cell: (c) => (
          <div className="ms-auto flex w-[110px] items-center justify-end gap-2">
            <span className="tabular-nums">{fmt.percent(c.getValue(), 1)}</span>
            <span className="h-1 w-10 rounded-full bg-line" aria-hidden>
              <span className="block h-full rounded-full bg-blue" style={{ width: Math.min(100, c.getValue() * 100 * 8) + '%' }} />
            </span>
          </div>
        ),
      }),
      col.accessor('sizeBytes', { header: t('blocksPage.size'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums">{fmt.unit(c.getValue() / 1024, 'kilobyte', 'short', 1)}</span> }),
      col.display({
        id: 'finality',
        header: t('blocksPage.finality'),
        cell: () => (
          <Badge tone="green" className="gap-1" title={t('blocksPage.finalityNote')}>
            <CircleCheck className="size-3" aria-hidden /> {t('blocksPage.finalized')}
          </Badge>
        ),
      }),
    ],
    [t, fmt, now],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('navigation.blocks')}
        description={t('blocksPage.description', { chain: chain.name })}
        badge={
          <span className="inline-flex items-center gap-2">
            <span className="chip border-green/30 text-green">
              <i className="size-1.5 animate-pulse-soft rounded-full bg-green" aria-hidden /> {t('blocksPage.live')}
            </span>
            <DemoBadge label={t('common.simulated')} />
          </span>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Boxes} label={t('metrics.blockHeight.label')} value={metrics ? fmt.integer(metrics.blockHeight) : '–'} loading={!metrics} />
        <StatCard icon={Timer} label={t('metrics.blockTime.label')} value={metrics ? fmt.seconds(metrics.blockTimeSec, 2) : '–'} loading={!metrics} />
        <StatCard icon={Layers} label={t('metrics.txPerBlock.label')} value={metrics ? fmt.decimal(metrics.txPerBlock, 2) : '–'} loading={!metrics} />
        <StatCard icon={Gauge} label={t('blocksPage.avgGas')} value={data ? fmt.percent(data.reduce((a, b) => a + b.gasUsed / b.gasLimit, 0) / Math.max(1, data.length), 1) : '–'} loading={!data} />
      </div>
      <Panel className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3" role="search" aria-label={t('blocksPage.filtersLabel')}>
          <Input type="search" value={q} onChange={(e) => setParam('q', e.target.value)} placeholder={t('blocksPage.filterPlaceholder')} aria-label={t('blocksPage.filterPlaceholder')} className="min-w-[200px] max-w-[320px] flex-1" />
          <label className="flex items-center gap-2 text-[12.5px] text-fg-2">
            <Switch checked={withTxs} onCheckedChange={(v) => setParam('txs', v ? '1' : '')} aria-label={t('blocksPage.withTxsOnly')} />
            {t('blocksPage.withTxsOnly')}
          </label>
          <Select aria-label={t('txPage.network')} className="w-[160px]" value={chain.id} onValueChange={setChain} options={SELECTABLE_CHAINS.map((c) => ({ value: c.id, label: c.name }))} />
          {q || withTxs ? (
            <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              <FilterX className="size-3.5" aria-hidden /> {t('common.clearFilters')}
            </Button>
          ) : null}
        </div>
        <DataTable
          data={rows}
          columns={columns}
          caption={t('blocksPage.tableCaption', { chain: chain.name })}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          pageSize={15}
          pageSizes={[15, 30, 50]}
          initialSort={[{ id: 'height', desc: true }]}
          resetPageKey={q + '|' + withTxs + '|' + chain.id}
          onRowClick={(b) => navigate(paths.block(b.height))}
          getRowId={(b) => String(b.height)}
          minWidth={1000}
          emptyTitle={t('blocksPage.emptyTitle')}
        />
      </Panel>
    </div>
  );
}
