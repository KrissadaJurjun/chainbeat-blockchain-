import { ArrowLeft, Info } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AddressLink } from '@/components/explorer/AddressLink';
import { TxStatusBadge, TxTypeBadge } from '@/components/explorer/TxParts';
import { Button } from '@/components/ui/Button';
import { Hash } from '@/components/ui/Copy';
import { DemoBadge } from '@/components/ui/Demo';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { JsonViewer } from '@/components/ui/JsonViewer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { useTransactionView } from '@/hooks/useDemoTx';
import { useFormat } from '@/hooks/useFormat';
import { paths } from '@/lib/paths';
import { buildRawTx, buildTxEvents, messageType } from '@/lib/txView';
import { useChain } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';
import type { Tx } from '@/types/domain';

function Events({ tx }: { tx: Tx }) {
  const { t } = useTranslation();
  const chain = useChain();
  const events = buildTxEvents(tx, chain);
  return (
    <section aria-labelledby="tx-events">
      <h2 id="tx-events" className="mb-2 font-display text-[14px] font-semibold text-fg">
        {t('txPage.events')} <span className="ms-1 text-[12px] font-normal text-fg-3">({events.length})</span>
      </h2>
      <div className="space-y-2">
        {events.map((e, i) => (
          <details key={i} className="rounded-xl border border-line bg-card/40 open:bg-card/60">
            <summary className="cursor-pointer px-3.5 py-2.5 font-mono text-[12.5px] text-fg-2">{e.type}</summary>
            <dl dir="ltr" className="space-y-1 border-t border-line px-3.5 py-2.5 font-mono text-[11.5px]">
              {e.attributes.map((a, j) => (
                <div key={j} className="flex flex-wrap gap-x-3">
                  <dt className="min-w-[110px] text-fg-3">{a.key}</dt>
                  <dd className="min-w-0 break-all text-fg">{a.value}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
      {tx.status === 'failed' ? <p className="mt-2 text-[12px] text-fg-3">{t('txPage.failedEvents')}</p> : null}
    </section>
  );
}

function Summary({ tx }: { tx: Tx }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const now = getSimNow();
  const rows: Array<[string, React.ReactNode]> = [
    [t('common.hash'), <Hash key="a" value={tx.hash} full className="max-w-full" />],
    [t('txPage.network'), chain.name + ' (' + chain.chainId + ')'],
    [t('txPage.block'), <Link key="b" to={paths.block(tx.height)} className="tabular-nums text-cyan hover:underline">{fmt.integer(tx.height)}</Link>],
    [t('common.time'), fmt.dateTime(tx.time, { dateStyle: 'medium', timeStyle: 'medium' }) + ' · ' + fmt.relative(tx.time, now)],
    [t('txPage.from'), <AddressLink key="c" address={tx.from} at={tx.height} full />],
  ];
  if (tx.to) rows.push([tx.to.includes('valoper1') ? t('txPage.validator') : t('txPage.to'), <AddressLink key="d" address={tx.to} at={tx.height} full />]);
  rows.push(
    [t('txPage.token'), tx.symbol],
    [t('common.amount'), <span key="e" className="tabular-nums">{fmt.token(tx.amount, tx.symbol, 6)}</span>],
    [t('common.fee'), <span key="f" className="tabular-nums">{fmt.token(tx.feeAmount, tx.feeSymbol, 6)}</span>],
    [t('txPage.gasUsed'), <span key="g" className="tabular-nums">{fmt.integer(tx.gasUsed)}</span>],
    [t('txPage.gasWanted'), <span key="h" className="tabular-nums">{fmt.integer(tx.gasWanted)}</span>],
    [t('txPage.messageType'), <code key="i" dir="ltr" className="break-all font-mono text-[12px]">{messageType(tx.type)}</code>],
    [t('txPage.memo'), tx.memo || t('txPage.noMemo')],
  );
  return (
    <dl className="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-4 border-b border-line pb-2.5">
          <dt className="shrink-0 text-fg-3">{k}</dt>
          <dd className="min-w-0 text-end font-medium text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function TransactionDetailPage() {
  const { t } = useTranslation();
  const chain = useChain();
  const { hash = '' } = useParams();
  const { data: tx, isLoading, isError, refetch, isFetching, isDemo } = useTransactionView(hash);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('txPage.detailTitle')}
        description={t('txPage.detailDescription', { chain: chain.name })}
        badge={<DemoBadge label={t('common.simulated')} />}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to={paths.transactions}>
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t('navigation.transactions')}
            </Link>
          </Button>
        }
      />
      {isLoading ? (
        <Panel className="p-4">
          <Skeleton className="h-[320px]" />
        </Panel>
      ) : isError ? (
        <Panel className="p-4">
          <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
        </Panel>
      ) : !tx ? (
        <Panel className="p-4">
          <EmptyState title={t('txPage.notFoundTitle')} description={t('txPage.notFoundBody', { chain: chain.name })} action={<Button asChild variant="primary"><Link to={paths.transactions}>{t('navigation.transactions')}</Link></Button>} />
        </Panel>
      ) : (
        <>
          <Panel className="space-y-5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <TxStatusBadge status={tx.status} />
              <TxTypeBadge type={tx.type} />
            </div>
            {tx.errorCode ? (
              <p role="alert" className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[12.5px] text-red">
                {t('txPage.failedBecause', { reason: tx.errorCode })}
              </p>
            ) : null}
            <Summary tx={tx} />
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-fg-3">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {isDemo ? t('txPage.demoWalletNote') : t('txPage.syntheticNote')}
            </p>
          </Panel>
          <Panel className="p-4">
            <Events tx={tx} />
          </Panel>
          <Panel className="p-4">
            <JsonViewer data={buildRawTx(tx, chain)} caption={t('txPage.raw')} />
          </Panel>
        </>
      )}
    </div>
  );
}
