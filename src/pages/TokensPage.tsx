import { useMemo } from 'react';
import { Coins, Droplets, Link2, ShieldCheck } from 'lucide-react';
import { createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Hash } from '@/components/ui/Copy';
import { DemoBadge } from '@/components/ui/Demo';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { useTokens } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { cn } from '@/lib/utils';
import { useChain } from '@/stores/chainStore';
import type { AssetKind, TokenRow } from '@/types/domain';

const col = createColumnHelper<TokenRow>();
const KIND_TONE: Record<AssetKind, 'purple' | 'cyan' | 'yellow' | 'green' | 'blue'> = { native: 'purple', ibc: 'cyan', external: 'yellow', stable: 'green', liquid: 'blue' };

export default function TokensPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const { data, isLoading, isError, refetch } = useTokens();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((r) => !needle || r.symbol.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle) || r.denom.toLowerCase().includes(needle));
  }, [data, q]);

  const columns = useMemo(
    () => [
      col.accessor('symbol', {
        header: t('tokens.col.token'),
        cell: ({ row }) => (
          <div className="flex min-w-[150px] items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full text-[11px] font-bold text-[var(--c-canvas)]" style={{ background: `var(--c-${row.original.color})` }} aria-hidden>
              {row.original.symbol.slice(0, 2)}
            </span>
            <span>
              <span className="block font-semibold text-fg">{row.original.symbol}</span>
              <span className="block text-[11.5px] text-fg-3">{row.original.name}</span>
            </span>
          </div>
        ),
      }),
      col.accessor('kind', { header: t('tokens.col.type'), cell: (c) => <Badge tone={KIND_TONE[c.getValue()]}>{t(`tokens.kinds.${c.getValue()}`)}</Badge> }),
      col.accessor('denom', { header: t('tokens.col.denom'), enableSorting: false, cell: (c) => <Hash value={c.getValue()} head={10} tail={6} /> }),
      col.accessor('priceUsd', { header: t('tokens.col.price'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums text-fg">{fmt.currency(c.getValue(), 'USD', { maximumFractionDigits: c.getValue() < 1 ? 4 : 2 })}</span> }),
      col.accessor('change24h', { header: t('tokens.col.change'), meta: { align: 'end' }, cell: (c) => <span className={cn('tabular-nums', c.getValue() >= 0 ? 'text-green' : 'text-red')}>{fmt.signedPercent(c.getValue(), 2)}</span> }),
      col.accessor('supply', { header: t('tokens.col.supply'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums">{fmt.compact(c.getValue(), 2)}</span> }),
      col.accessor('holders', { header: t('tokens.col.holders'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums">{fmt.compact(c.getValue(), 1)}</span> }),
      col.accessor('marketCapUsd', { header: t('tokens.col.marketCap'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums text-fg">{fmt.usdCompact(c.getValue())}</span> }),
    ],
    [t, fmt],
  );

  const count = (k: AssetKind): number => (data ?? []).filter((r) => r.kind === k).length;

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.tokenExplorer')} description={t('tokens.description', { chain: chain.name })} badge={<DemoBadge label={t('common.simulated')} />} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Coins} label={t('tokens.stats.total')} value={data ? fmt.integer(data.length) : '–'} loading={isLoading} />
        <StatCard icon={Link2} label={t('tokens.kinds.ibc')} value={fmt.integer(count('ibc'))} loading={isLoading} />
        <StatCard icon={Droplets} label={t('tokens.kinds.liquid')} value={fmt.integer(count('liquid'))} loading={isLoading} />
        <StatCard icon={ShieldCheck} label={t('tokens.kinds.stable')} value={fmt.integer(count('stable'))} loading={isLoading} />
      </div>
      <Panel className="p-4">
        <Input
          type="search"
          value={q}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value) next.set('q', e.target.value);
            else next.delete('q');
            setParams(next, { replace: true });
          }}
          placeholder={t('tokens.filterPlaceholder')}
          aria-label={t('tokens.filterPlaceholder')}
          className="mb-3 max-w-[320px]"
        />
        <DataTable
          data={rows}
          columns={columns}
          caption={t('tokens.tableCaption', { chain: chain.name })}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          pageSize={10}
          initialSort={[{ id: 'marketCapUsd', desc: true }]}
          resetPageKey={q}
          getRowId={(r) => r.symbol}
          minWidth={960}
        />
      </Panel>
    </div>
  );
}
