import { useMemo } from 'react';
import { Percent, ShieldCheck, Trophy, Users } from 'lucide-react';
import { createColumnHelper } from '@tanstack/react-table';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data/DataTable';
import { ValidatorAvatar } from '@/components/governance/ValidatorAvatar';
import { ValidatorStatusBadge } from '@/components/governance/ValidatorParts';
import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/Demo';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { StatCard } from '@/components/ui/StatCard';
import { useValidators } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { powerCoefficient } from '@/lib/consensus';
import { downloadText, toCsv } from '@/lib/csv';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import { useChain } from '@/stores/chainStore';
import type { Validator, ValidatorStatus } from '@/types/domain';

type StatusFilter = 'all' | ValidatorStatus;
const STATUS_FILTERS: StatusFilter[] = ['all', 'active', 'inactive', 'jailed'];
const col = createColumnHelper<Validator>();


export default function ValidatorsPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const statusParam = params.get('status') as StatusFilter | null;
  const status: StatusFilter = statusParam && STATUS_FILTERS.includes(statusParam) ? statusParam : 'all';
  const { data, isLoading, isError, refetch } = useValidators();


  const setParam = (key: string, value: string): void => {
    const next = new URLSearchParams(params);
    if (value && value !== 'all') next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((v) => (status === 'all' || v.status === status) && (!needle || v.moniker.toLowerCase().includes(needle) || v.operatorAddress.toLowerCase().includes(needle)));
  }, [data, q, status]);

  const stats = useMemo(() => {
    const active = (data ?? []).filter((v) => v.status === 'active');
    const top10 = active.slice(0, 10).reduce((a, v) => a + v.votingPower, 0);
    const avgCommission = active.length ? active.reduce((a, v) => a + v.commission, 0) / active.length : 0;
    return { active: active.length, top10, avgCommission, nakamoto: powerCoefficient(data ?? [], 1 / 3) };
  }, [data]);

  const columns = useMemo(
    () => [
      col.accessor('rank', { header: '#', cell: (c) => <span className="tabular-nums text-fg-3">{c.getValue()}</span> }),
      col.accessor('moniker', {
        header: t('validators.col.validator'),
        cell: ({ row }) => (
          <div className="flex min-w-[200px] items-center gap-2.5">
            <ValidatorAvatar name={row.original.moniker} className="size-8 text-[11px]" />
            <div className="min-w-0">
              <Link to={paths.validator(row.original.operatorAddress)} className="block truncate font-medium text-fg hover:text-cyan hover:underline">
                {row.original.moniker}
              </Link>
              <p className="ltr-isolate truncate font-mono text-[11px] text-fg-3">{row.original.operatorAddress.slice(0, 18)}…</p>
            </div>
          </div>
        ),
      }),
      col.accessor('votingPower', {
        header: t('validators.col.power'),
        meta: { align: 'end' },
        cell: (c) => (
          <div className="ms-auto flex w-[130px] flex-col items-end gap-1">
            <span className="font-medium tabular-nums text-fg">{fmt.percent(c.getValue(), 2)}</span>
            <span className="h-1 w-full rounded-full bg-line" aria-hidden>
              <span className="block h-full rounded-full bg-purple" style={{ width: `${Math.min(100, (c.getValue() / (rows[0]?.votingPower || 1)) * 100)}%` }} />
            </span>
          </div>
        ),
      }),
      col.accessor('tokens', { header: t('validators.col.tokens'), meta: { align: 'end' }, cell: (c) => <span className="whitespace-nowrap tabular-nums">{fmt.tokenCompact(c.getValue(), chain.symbol)}</span> }),
      col.accessor('cumulativePower', { header: t('validators.col.cumulative'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums">{c.row.original.status === 'active' ? fmt.percent(c.getValue(), 1) : '—'}</span> }),
      col.accessor('commission', { header: t('validators.col.commission'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums">{fmt.percent(c.getValue(), 1)}</span> }),
      col.accessor('uptime', { header: t('validators.col.uptime'), meta: { align: 'end' }, cell: (c) => <span className={cn('tabular-nums', c.getValue() < 0.98 && 'text-yellow')}>{fmt.percent(c.getValue(), 2)}</span> }),
      col.accessor('change24h', {
        header: t('validators.col.change'),
        meta: { align: 'end' },
        cell: (c) => (
          <span className={cn('tabular-nums', c.getValue() >= 0 ? 'text-green' : 'text-red')}>
            {c.getValue() >= 0 ? '+' : '−'}
            {fmt.tokenCompact(Math.abs(c.getValue()), chain.symbol)}
          </span>
        ),
      }),
      col.accessor('status', { header: t('common.status'), cell: (c) => <ValidatorStatusBadge status={c.getValue()} /> }),
      col.display({
        id: 'action',
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        enableSorting: false,
        meta: { align: 'end' },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5">
            <Button size="sm" variant="ghost" asChild>
              <Link to={paths.validator(row.original.operatorAddress)}>{t('validators.col.details')}</Link>
            </Button>
            <Button size="sm" variant="secondary" disabled={row.original.status !== 'active'} onClick={() => navigate(paths.stake + '?validator=' + encodeURIComponent(row.original.operatorAddress))}>
              {t('validators.stake')}
            </Button>
          </span>
        ),
      }),
    ],
    [t, fmt, chain.symbol, navigate, rows],
  );

  const exportCsv = (): void => {
    const header = [t('validators.col.validator'), 'Address', t('validators.col.power'), t('validators.col.commission'), t('validators.col.uptime'), t('common.status')];
    const body = rows.map((v) => [v.moniker, v.operatorAddress, (v.votingPower * 100).toFixed(4), (v.commission * 100).toFixed(2), (v.uptime * 100).toFixed(2), v.status]);
    downloadText(`chainbeat-validators-${chain.id}.csv`, toCsv([header, ...body]));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('navigation.validators')}
        description={t('validators.pageDescription', { chain: chain.name })}
        badge={<DemoBadge label={t('common.simulated')} />}
        actions={
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            {t('common.exportCsv')}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label={t('validators.stats.active')} value={fmt.integer(stats.active)} loading={isLoading} />
        <StatCard icon={Trophy} label={t('validators.stats.nakamoto')} value={fmt.integer(stats.nakamoto)} hint={t('validators.stats.nakamotoHint')} loading={isLoading} />
        <StatCard icon={ShieldCheck} label={t('validators.stats.top10')} value={fmt.percent(stats.top10, 1)} loading={isLoading} />
        <StatCard icon={Percent} label={t('validators.stats.commission')} value={fmt.percent(stats.avgCommission, 2)} loading={isLoading} />
      </div>

      <Panel className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Input
            type="search"
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder={t('validators.filterPlaceholder')}
            aria-label={t('validators.filterPlaceholder')}
            className="max-w-[320px]"
          />
          <Segmented
            aria-label={t('validators.statusFilter')}
            size="sm"
            value={status}
            onChange={(v) => setParam('status', v)}
            options={STATUS_FILTERS.map((s) => ({ value: s, label: s === 'all' ? t('common.all') : t(`validators.status.${s}`) }))}
          />
        </div>
        <DataTable
          data={rows}
          columns={columns}
          caption={t('validators.tableCaption', { chain: chain.name })}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          pageSize={10}
          initialSort={[{ id: 'votingPower', desc: true }]}
          resetPageKey={`${q}|${status}`}
          onRowClick={(v) => navigate(paths.validator(v.operatorAddress))}
          getRowId={(v) => v.operatorAddress}
          minWidth={1100}
        />
      </Panel>
    </div>
  );
}
