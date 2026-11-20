import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ValidatorDetailView } from '@/components/governance/ValidatorDetailView';
import { ValidatorAvatar } from '@/components/governance/ValidatorAvatar';
import { ValidatorStatusBadge } from '@/components/governance/ValidatorParts';
import { Drawer, DrawerContent } from '@/components/ui/Drawer';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { useMetrics, useValidators } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import { useChain } from '@/stores/chainStore';
import type { Validator } from '@/types/domain';

type SortKey = 'power' | 'commission' | 'uptime';
type StatusFilter = 'active' | 'inactive' | 'all';
const SORTS: readonly SortKey[] = ['power', 'commission', 'uptime'];
const FILTERS: readonly StatusFilter[] = ['active', 'inactive', 'all'];
const COMPARE: Record<SortKey, (a: Validator, b: Validator) => number> = {
  power: (a, b) => b.tokens - a.tokens,
  commission: (a, b) => a.commission - b.commission || b.tokens - a.tokens,
  uptime: (a, b) => b.uptime - a.uptime || b.tokens - a.tokens,
};

/** Validator activity: the top rows by voting power, commission or uptime, filterable; a row opens a detail drawer. */
export function ValidatorsPanel() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const { data, isLoading, isError, refetch, isFetching } = useValidators();
  const price = useMetrics().data?.priceUsd ?? 0;
  const [sort, setSort] = useState<SortKey>('power');
  const [filter, setFilter] = useState<StatusFilter>('active');
  const [selected, setSelected] = useState<Validator | null>(null);

  const active = useMemo(() => (data ?? []).filter((v) => v.status === 'active'), [data]);
  const top = useMemo(() => {
    const pool = (data ?? []).filter((v) => (filter === 'all' ? true : filter === 'active' ? v.status === 'active' : v.status !== 'active'));
    return [...pool].sort(COMPARE[sort]).slice(0, 4);
  }, [data, filter, sort]);
  const maxShare = Math.max(1e-9, ...top.map((v) => v.votingPower));

  return (
    <Panel aria-labelledby="validators-title" className="flex min-h-[290px] flex-col p-4">
      <PanelHeader
        id="validators-title"
        title={t('validators.activitiesTitle')}
        subtitle={
          <>
            {t('validators.bondedVals')} <b className="font-semibold tabular-nums text-fg-2">{data ? fmt.integer(active.length) : '–'}</b>
          </>
        }
        actions={
          <>
            <Select variant="ghost" aria-label={t('validators.sortBy')} value={sort} onValueChange={(v) => setSort(v as SortKey)} options={SORTS.map((s) => ({ value: s, label: t('validators.sort.' + s) }))} />
            <Link to={paths.validators} aria-label={t('validators.viewAll')} className="grid size-8 place-items-center rounded-lg text-fg-2 transition-colors hover:bg-hover hover:text-fg">
              <ChevronRight className="size-[18px] rtl:rotate-180" aria-hidden />
            </Link>
          </>
        }
      />
      <Segmented
        aria-label={t('validators.statusFilter')}
        size="sm"
        className="mt-2.5 self-start"
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ value: f, label: f === 'all' ? t('common.all') : t('validators.status.' + f) }))}
      />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} retrying={isFetching} className="py-6" />
      ) : (
        <ul className="mt-2.5 flex flex-1 flex-col gap-2" aria-label={t('validators.activitiesTitle')}>
          {isLoading
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="flex-1">
                  <Skeleton className="h-full min-h-[50px] rounded-xl" />
                </li>
              ))
            : top.map((v) => (
                <li key={v.operatorAddress} className="flex-1">
                  <button
                    type="button"
                    onClick={() => setSelected(v)}
                    aria-haspopup="dialog"
                    title={t('validators.hoverTip', { commission: fmt.percent(v.commission, 1), uptime: fmt.percent(v.uptime, 2), delegators: fmt.integer(v.delegators) })}
                    className="surface-row flex h-full min-h-[50px] w-full items-center gap-3 px-3 py-2 text-start outline-none transition-colors hover:bg-hover/60 focus-visible:ring-2 focus-visible:ring-cyan/50"
                  >
                    <ValidatorAvatar name={v.moniker} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[12.5px] font-semibold text-fg">{v.moniker}</span>
                        {v.status !== 'active' ? <ValidatorStatusBadge status={v.status} /> : null}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="w-[46px] shrink-0 text-[10.5px] tabular-nums text-purple">{fmt.percent(v.votingPower, 2)}</span>
                        <span className="relative h-[3px] flex-1 rounded-full bg-line" aria-hidden>
                          <span className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-cyan/70 to-purple" style={{ width: (v.votingPower / maxShare) * 100 + '%' }} />
                          <span className="absolute top-1/2 size-[7px] -translate-y-1/2 rounded-full border border-purple bg-canvas" style={{ insetInlineStart: 'calc(' + (v.votingPower / maxShare) * 100 + '% - 4px)' }} />
                        </span>
                        <span className="shrink-0 text-[10.5px] tabular-nums text-fg-3">{t('validators.commissionShort', { value: fmt.percent(v.commission, 0) })}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-end">
                      <span className="block text-[12px] font-semibold tabular-nums text-fg">{fmt.tokenCompact(v.tokens, chain.symbol)}</span>
                      <span className={cn('block text-[11px] tabular-nums', v.change24h >= 0 ? 'text-green' : 'text-red')}>
                        {v.change24h >= 0 ? '▲' : '▼'} {fmt.tokenCompact(Math.abs(v.change24h), chain.symbol)}
                        <span className="sr-only"> {t('validators.col.change')}</span>
                      </span>
                      <span className="block text-[10.5px] tabular-nums text-fg-3">{fmt.usdCompact(v.tokens * price)}</span>
                    </span>
                  </button>
                </li>
              ))}
          {!isLoading && top.length === 0 ? <li className="py-6 text-center text-[12.5px] text-fg-3">{t('validators.noMatching')}</li> : null}
        </ul>
      )}

      <Drawer open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        {selected ? (
          <DrawerContent title={selected.moniker} description={t('validators.detailDescription', { chain: chain.name })}>
            <ValidatorDetailView address={selected.operatorAddress} inDrawer onNavigate={() => setSelected(null)} />
          </DrawerContent>
        ) : null}
      </Drawer>
    </Panel>
  );
}
