import { useMemo } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { createColumnHelper } from '@tanstack/react-table';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data/DataTable';
import { AddressLink } from '@/components/explorer/AddressLink';
import { TxStatusBadge, TxTypeBadge } from '@/components/explorer/TxParts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Hash } from '@/components/ui/Copy';
import { DemoBadge } from '@/components/ui/Demo';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { useBlock, useMetrics } from '@/hooks/useChainData';
import { useDemoTxs } from '@/hooks/useDemoTx';
import { useFormat } from '@/hooks/useFormat';
import { paths } from '@/lib/paths';
import { useChain } from '@/stores/chainStore';
import type { Tx } from '@/types/domain';

const col = createColumnHelper<Tx>();

export default function BlockDetailPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const navigate = useNavigate();
  const params = useParams();
  const height = Number(params.height);
  const valid = Number.isInteger(height) && height > 0;
  const { data, isLoading, isError, refetch, isFetching } = useBlock(valid ? height : 0);
  const tip = useMetrics().data?.blockHeight;
  const demoInBlock = useDemoTxs().filter((x) => x.height === height);

  const columns = useMemo(
    () => [
      col.accessor('hash', {
        header: t('common.hash'),
        enableSorting: false,
        cell: (c) => (
          <Link to={paths.tx(c.getValue())} className="ltr-isolate font-mono text-[12px] text-cyan hover:underline">
            {c.getValue().slice(0, 12)}…{c.getValue().slice(-6)}
          </Link>
        ),
      }),
      col.accessor('type', { header: t('common.type'), cell: (c) => <TxTypeBadge type={c.getValue()} /> }),
      col.accessor('status', { header: t('common.status'), cell: (c) => <TxStatusBadge status={c.getValue()} /> }),
      col.accessor('from', { header: t('txPage.from'), enableSorting: false, cell: (c) => <AddressLink address={c.getValue()} at={c.row.original.height} head={8} tail={4} /> }),
      col.accessor('amount', { header: t('common.amount'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums text-fg">{fmt.token(c.getValue(), c.row.original.symbol)}</span> }),
      col.accessor('feeAmount', { header: t('common.fee'), meta: { align: 'end' }, cell: (c) => <span className="tabular-nums">{fmt.token(c.getValue(), c.row.original.feeSymbol, 6)}</span> }),
    ],
    [t, fmt],
  );

  const title = valid ? t('blockDetail.title', { height: fmt.integer(height) }) : t('blockDetail.invalid');

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={t('blockDetail.description', { chain: chain.name })}
        badge={<DemoBadge label={t('common.simulated')} />}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to={paths.blocks}>
                <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t('navigation.blocks')}
              </Link>
            </Button>
            <Button variant="secondary" size="icon-sm" aria-label={t('blockDetail.previous')} disabled={!valid || height <= 1} onClick={() => navigate(paths.block(height - 1))}>
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
            </Button>
            <Button variant="secondary" size="icon-sm" aria-label={t('blockDetail.next')} disabled={!valid || (tip !== undefined && height >= tip)} onClick={() => navigate(paths.block(height + 1))}>
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
            </Button>
          </>
        }
      />

      {isLoading ? (
        <Skeleton className="h-[260px] rounded-2xl" />
      ) : isError ? (
        <Panel>
          <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
        </Panel>
      ) : !data ? (
        <Panel>
          <EmptyState title={t('blockDetail.notFoundTitle')} description={t('blockDetail.notFoundBody', { chain: chain.name })} action={<Button asChild variant="primary"><Link to={paths.blocks}>{t('navigation.blocks')}</Link></Button>} />
        </Panel>
      ) : (
        <>
          <Panel className="p-4">
            <dl className="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
              {[
                [t('common.hash'), <Hash key="h" value={data.block.hash} full className="max-w-full" />],
                [
                  t('blockDetail.parentHash'),
                  height > 1 ? (
                    <span key="p" className="inline-flex max-w-full items-center gap-1">
                      <Link to={paths.block(height - 1)} className="ltr-isolate truncate font-mono text-[12px] text-cyan hover:underline" title={data.block.parentHash}>
                        {data.block.parentHash.slice(0, 16)}…
                      </Link>
                    </span>
                  ) : (
                    t('blockDetail.genesis')
                  ),
                ],
                [t('common.time'), fmt.dateTime(data.block.time, { dateStyle: 'medium', timeStyle: 'medium' })],
                [t('common.status'), <Badge key="s" tone="green" title={t('blocksPage.finalityNote')}>{t('blocksPage.finalized')}</Badge>],
                [t('blocksPage.proposer'), <span key="v" className="inline-flex items-center gap-1.5"><Link to={paths.validator(data.block.proposer.address)} className="text-cyan hover:underline">{data.block.proposer.moniker}</Link><AddressLink address={data.block.proposer.address} head={10} tail={4} noCopy /></span>],
                [t('blocksPage.txs'), fmt.integer(data.block.txCount)],
                [t('blocksPage.gas'), `${fmt.integer(data.block.gasUsed)} / ${fmt.integer(data.block.gasLimit)} (${fmt.percent(data.block.gasUsed / data.block.gasLimit, 2)})`],
                [t('blocksPage.size'), fmt.unit(data.block.sizeBytes / 1024, 'kilobyte', 'short', 1)],
              ].map(([k, v], i) => (
                <div key={i} className="flex items-start justify-between gap-4 border-b border-line pb-2.5 last:border-0 sm:[&:nth-last-child(2)]:border-0">
                  <dt className="shrink-0 text-fg-3">{k}</dt>
                  <dd className="min-w-0 text-end font-medium text-fg">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          {demoInBlock.length > 0 ? (
            <Panel className="p-4">
              <h2 className="mb-1 font-display text-[15px] font-semibold">{t('blockDetail.demoTxs')}</h2>
              <p className="mb-2 text-[12px] text-fg-3">{t('blockDetail.demoTxsNote')}</p>
              <ul className="divide-y divide-line text-[12.5px]">
                {demoInBlock.map((x) => (
                  <li key={x.hash} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <Link to={paths.tx(x.hash)} title={x.hash} className="ltr-isolate font-mono text-[12px] text-cyan hover:underline">
                      {x.hash.slice(0, 12)}…{x.hash.slice(-6)}
                    </Link>
                    <TxTypeBadge type={x.type} />
                    <span className="ms-auto tabular-nums text-fg">{fmt.token(x.amount, x.symbol)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
          <Panel className="p-4">
            <h2 className="mb-3 font-display text-[15px] font-semibold">{t('blockDetail.transactions', { count: data.txs.length })}</h2>
            <DataTable data={data.txs} columns={columns} caption={t('blockDetail.txCaption', { height: fmt.integer(height) })} pageSize={10} getRowId={(x) => x.hash} onRowClick={(x) => navigate(paths.tx(x.hash))} minWidth={780} emptyTitle={t('blockDetail.noTxs')} emptyBody=" " />
          </Panel>
        </>
      )}
    </div>
  );
}
