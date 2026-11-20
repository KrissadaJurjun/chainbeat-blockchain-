import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useFormat } from '@/hooks/useFormat';
import { paths } from '@/lib/paths';
import { shortHash } from '@/lib/utils';
import type { Tx } from '@/types/domain';
import { AddressLink } from './AddressLink';
import { TxStatusBadge, TxTypeBadge } from './TxParts';

interface TxCardsProps {
  txs: readonly Tx[];
  now: number;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  pageSize?: number;
}

/** The mobile layout of a transaction list: one card per transaction instead of a wide table. */
export function TxCards({ txs, now, loading, error, onRetry, pageSize = 10 }: TxCardsProps) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [visible, setVisible] = useState(pageSize);

  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[92px]" />)}</div>;
  if (error && txs.length === 0) return <ErrorState onRetry={onRetry} />;
  if (txs.length === 0) return <EmptyState title={t('txPage.emptyTitle')} description={t('common.noResults')} />;

  return (
    <div>
      <ul className="space-y-2" aria-label={t('txPage.cardsLabel')}>
        {txs.slice(0, visible).map((x) => (
          <li key={x.hash} className="rounded-xl border border-line bg-card/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <Link to={paths.tx(x.hash)} className="ltr-isolate truncate font-mono text-[12.5px] text-cyan hover:underline">
                {shortHash(x.hash, 10, 6)}
              </Link>
              <TxStatusBadge status={x.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-fg-2">
              <TxTypeBadge type={x.type} />
              <span className="font-medium tabular-nums text-fg">{fmt.token(x.amount, x.symbol)}</span>
              <Link to={paths.block(x.height)} className="tabular-nums hover:text-cyan hover:underline">
                #{fmt.integer(x.height)}
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-3">
              <AddressLink address={x.from} at={x.height} head={7} tail={4} noCopy />
              {x.to ? (
                <>
                  <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
                  <AddressLink address={x.to} at={x.height} head={7} tail={4} noCopy />
                </>
              ) : null}
              <span className="ms-auto whitespace-nowrap tabular-nums" title={fmt.dateTime(x.time, { dateStyle: 'medium', timeStyle: 'medium' })}>
                {fmt.relative(x.time, now)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {visible < txs.length ? (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => setVisible((v) => v + pageSize)}>
            {t('common.showMore', { count: Math.min(pageSize, txs.length - visible) })}
          </Button>
        </div>
      ) : null}
      <p className="mt-2 text-center text-[11.5px] text-fg-3" aria-live="polite">
        {t('common.showing', { from: 1, to: Math.min(visible, txs.length), total: txs.length })}
      </p>
    </div>
  );
}
