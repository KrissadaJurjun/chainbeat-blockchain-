import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AddressLink } from '@/components/explorer/AddressLink';
import { HistoryChart } from '@/components/charts/HistoryChart';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useMetrics, useValidatorDetail } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { paths } from '@/lib/paths';
import { useChain } from '@/stores/chainStore';
import { ValidatorAvatar } from './ValidatorAvatar';
import { ValidatorStatusBadge } from './ValidatorParts';

interface ValidatorDetailViewProps {
  address: string;
  /** Inside the dashboard drawer: a link to the full page is shown instead of repeating the page header. */
  inDrawer?: boolean;
  onNavigate?: () => void;
}

/** Everything about one (fictional) validator: figures, description, uptime and voting-power history, recent blocks. */
export function ValidatorDetailView({ address, inDrawer, onNavigate }: ValidatorDetailViewProps) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const price = useMetrics().data?.priceUsd ?? 0;
  const { data, isLoading, isError, refetch, isFetching } = useValidatorDetail(address);

  if (isLoading) return <Skeleton className="h-[420px]" />;
  if (isError) return <ErrorState onRetry={() => void refetch()} retrying={isFetching} />;
  if (!data) {
    return (
      <EmptyState
        title={t('validators.notFoundTitle')}
        description={t('validators.notFoundBody', { chain: chain.name })}
        action={
          <Button asChild variant="primary">
            <Link to={paths.validators} onClick={onNavigate}>
              {t('navigation.validators')}
            </Link>
          </Button>
        }
      />
    );
  }

  const { validator: v } = data;
  const facts: Array<[string, string]> = [
    [t('validators.col.power'), fmt.percent(v.votingPower, 2)],
    [t('validators.detail.bonded'), fmt.tokenCompact(v.tokens, chain.symbol)],
    [t('validators.col.commission'), fmt.percent(v.commission, 1)],
    [t('validators.col.uptime'), fmt.percent(v.uptime, 2)],
    [t('validators.detail.delegators'), fmt.integer(v.delegators)],
    [t('validators.detail.rank'), '#' + v.rank],
    [t('validators.detail.selfBonded'), fmt.tokenCompact(data.selfBonded, chain.symbol)],
    [t('validators.detail.proposed24h'), fmt.integer(data.proposed24h)],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <ValidatorAvatar name={v.moniker} className="size-12 text-[14px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[18px] font-bold text-fg">{v.moniker}</h2>
            <ValidatorStatusBadge status={v.status} />
          </div>
          <div className="mt-1">
            <AddressLink address={v.operatorAddress} full />
          </div>
        </div>
      </div>
      <p className="flex items-start gap-2 rounded-lg border border-yellow/30 bg-yellow/8 px-3 py-2 text-[12px] leading-relaxed text-fg-2">
        <Info className="mt-0.5 size-3.5 shrink-0 text-yellow" aria-hidden /> {t('validators.fictionalNote')}
      </p>
      <p className="text-[13px] leading-relaxed text-fg-2">{data.description}</p>
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {facts.map(([k, val]) => (
          <div key={k} className="metric-card px-3 py-2.5">
            <dt className="truncate text-[11px] text-fg-3">{k}</dt>
            <dd className="mt-0.5 truncate font-display text-[15px] font-bold tabular-nums text-fg">{val}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="val-uptime">
        <h3 id="val-uptime" className="mb-1 text-[13px] font-semibold text-fg">
          {t('validators.detail.uptimeHistory')} <span className="font-normal text-fg-3">· {t('validators.detail.last90')}</span>
        </h3>
        <HistoryChart data={data.uptimeHistory} name={t('validators.col.uptime')} format={(x) => fmt.percent(x, 1)} color="var(--c-green)" domain={[0.5, 1]} />
      </section>
      <section aria-labelledby="val-power">
        <h3 id="val-power" className="mb-1 text-[13px] font-semibold text-fg">
          {t('validators.detail.powerHistory')} <span className="font-normal text-fg-3">· {t('validators.detail.last30')}</span>
        </h3>
        <HistoryChart data={data.powerHistory} name={t('validators.col.power')} format={(x) => fmt.percent(x, 2)} color="var(--c-purple)" />
      </section>
      <section aria-labelledby="val-blocks">
        <h3 id="val-blocks" className="mb-2 text-[13px] font-semibold text-fg">
          {t('validators.detail.recentBlocks')}
        </h3>
        {data.recentBlocks.length === 0 ? (
          <p className="text-[12.5px] text-fg-3">{t('validators.detail.noBlocks')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {data.recentBlocks.map((b) => (
              <li key={b.height} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
                <Link to={paths.block(b.height)} onClick={onNavigate} className="tabular-nums text-cyan hover:underline">
                  #{fmt.integer(b.height)}
                </Link>
                <span className="text-fg-3">{t('validators.detail.txs', { count: b.txCount })}</span>
                <span className="tabular-nums text-fg-3">{fmt.relative(b.time)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="primary" size="sm">
          <Link to={paths.stake + '?validator=' + encodeURIComponent(v.operatorAddress)} onClick={onNavigate}>
            {t('validators.stakeWith')}
          </Link>
        </Button>
        {inDrawer ? (
          <Button asChild variant="secondary" size="sm">
            <Link to={paths.validator(v.operatorAddress)} onClick={onNavigate}>
              {t('validators.detail.openPage')}
            </Link>
          </Button>
        ) : null}
        <p className="basis-full text-[11.5px] text-fg-3">
          {t('validators.detail.website')}: {t('validators.detail.noWebsite')} · {t('validators.detail.valueUsd', { value: fmt.usdCompact(v.tokens * price) })}
        </p>
      </div>
    </div>
  );
}
