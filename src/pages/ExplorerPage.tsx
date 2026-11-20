import { ArrowRight, Boxes, Coins, ReceiptText, ShieldCheck, Timer, Vote } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AddressLink } from '@/components/explorer/AddressLink';
import { TxStatusBadge, TxTypeBadge } from '@/components/explorer/TxParts';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { DemoBadge } from '@/components/ui/Demo';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { useBlocks, useMetrics, useTransactions } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { paths } from '@/lib/paths';
import { shortHash } from '@/lib/utils';
import { useChain } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';

const SHORTCUTS = [
  { to: paths.blocks, key: 'navigation.blocks', icon: Boxes },
  { to: paths.transactions, key: 'navigation.transactions', icon: ReceiptText },
  { to: paths.validators, key: 'navigation.validators', icon: ShieldCheck },
  { to: paths.proposals, key: 'navigation.proposals', icon: Vote },
  { to: paths.tokens, key: 'navigation.tokenExplorer', icon: Coins },
] as const;

/** The Explorer home: search first, then what just happened on the (simulated) network. */
export default function ExplorerPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const metrics = useMetrics().data;
  const blocks = useBlocks(10);
  const txs = useTransactions(10);
  const now = getSimNow();

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.explorerHome')} description={t('explorer.description', { chain: chain.name })} badge={<DemoBadge label={t('common.simulated')} />} />
      <Panel className="p-4 sm:p-5">
        <h2 className="mb-1 font-display text-[15px] font-semibold text-fg">{t('explorer.searchTitle')}</h2>
        <p className="mb-3 text-[12.5px] text-fg-3">{t('search.hint', { prefix: chain.bech32Prefix })}</p>
        <GlobalSearch variant="inline" large />
        <ul className="mt-4 flex flex-wrap gap-2" aria-label={t('explorer.shortcuts')}>
          {SHORTCUTS.map(({ to, key, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line px-3 text-[12.5px] text-fg-2 transition-colors hover:border-active-line hover:bg-hover hover:text-fg">
                <Icon className="size-4 text-fg-3" aria-hidden /> {t(key)}
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Boxes} label={t('metrics.blockHeight.label')} value={metrics ? fmt.integer(metrics.blockHeight) : '–'} loading={!metrics} />
        <StatCard icon={Timer} label={t('metrics.blockTime.label')} value={metrics ? fmt.seconds(metrics.blockTimeSec, 2) : '–'} loading={!metrics} />
        <StatCard icon={ReceiptText} label={t('metrics.totalTransactions.label')} value={metrics ? fmt.compact(metrics.totalTransactions) : '–'} loading={!metrics} />
        <StatCard icon={ShieldCheck} label={t('validators.bondedVals')} value={fmt.integer(chain.activeValidators)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-4">
          <PanelHeader title={t('explorer.latestBlocks')} actions={<Link to={paths.blocks} className="inline-flex items-center gap-1 text-[12px] text-cyan hover:underline">{t('common.viewAll')} <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden /></Link>} />
          <div className="mt-3">
            {blocks.isLoading ? (
              <Skeleton className="h-[320px]" />
            ) : blocks.isError ? (
              <ErrorState onRetry={() => void blocks.refetch()} />
            ) : (
              <ul className="divide-y divide-line">
                {(blocks.data ?? []).map((b) => (
                  <li key={b.height} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-[12.5px]">
                    <Link to={paths.block(b.height)} className="font-medium tabular-nums text-cyan hover:underline">{fmt.integer(b.height)}</Link>
                    <Link to={paths.validator(b.proposer.address)} className="min-w-0 flex-1 truncate text-fg-2 hover:text-cyan hover:underline">{b.proposer.moniker}</Link>
                    <span className="tabular-nums text-fg-3">{t('validators.detail.txs', { count: b.txCount })}</span>
                    <span className="whitespace-nowrap tabular-nums text-fg-3" title={fmt.dateTime(b.time, { dateStyle: 'medium', timeStyle: 'medium' })}>{fmt.relative(b.time, now)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
        <Panel className="p-4">
          <PanelHeader title={t('explorer.latestTransactions')} actions={<Link to={paths.transactions} className="inline-flex items-center gap-1 text-[12px] text-cyan hover:underline">{t('common.viewAll')} <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden /></Link>} />
          <div className="mt-3">
            {txs.isLoading ? (
              <Skeleton className="h-[320px]" />
            ) : txs.isError ? (
              <ErrorState onRetry={() => void txs.refetch()} />
            ) : (txs.data ?? []).length === 0 ? (
              <EmptyState title={t('txPage.emptyTitle')} />
            ) : (
              <ul className="divide-y divide-line">
                {(txs.data ?? []).map((x) => (
                  <li key={x.hash} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[12.5px]">
                    <Link to={paths.tx(x.hash)} title={x.hash} className="ltr-isolate font-mono text-[12px] text-cyan hover:underline">{shortHash(x.hash, 8, 4)}</Link>
                    <TxTypeBadge type={x.type} />
                    <TxStatusBadge status={x.status} />
                    <span className="hidden min-w-0 flex-1 sm:block"><AddressLink address={x.from} at={x.height} head={7} tail={4} noCopy /></span>
                    <span className="ms-auto whitespace-nowrap tabular-nums text-fg">{fmt.token(x.amount, x.symbol)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
