import { useEffect, useId, useMemo, useState } from 'react';
import { Activity, Boxes, Clock, HeartPulse } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DemoBadge } from '@/components/ui/Demo';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { useBlocks } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useChain } from '@/stores/chainStore';
import { getSimNow } from '@/stores/simStore';
import type { Block } from '@/types/domain';

const W = 1000;
const H = 220;
const PAD = 24;
const BASE = 128;

/** One ECG-style beat: P wave, QRS spike (height ∝ transactions in the block), T wave. */
function beat(x: number, amp: number): string {
  return `L${x - 9} ${BASE}L${x - 7} ${BASE - 0.12 * amp}L${x - 5} ${BASE}L${x - 2.5} ${BASE + 0.18 * amp}L${x} ${BASE - amp}L${x + 2} ${BASE + 0.4 * amp}L${x + 4} ${BASE}L${x + 7} ${BASE - 0.2 * amp}L${x + 10} ${BASE}`;
}

/**
 * "Heartbeat": the chain's pulse. Every block is a beat; spacing follows real (simulated) block times
 * and the spike height follows how many transactions the block carried.
 */
export default function HeartbeatPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const { data, isLoading, isError, refetch } = useBlocks(60);
  const [now, setNow] = useState(() => getSimNow());

  // Tick once a second so "seconds since last block" is live between refetches.
  useEffect(() => {
    const id = window.setInterval(() => setNow(getSimNow()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const model = useMemo(() => {
    if (!data || data.length < 3) return null;
    const ordered: Block[] = [...data].reverse();
    const first = ordered[0] as Block;
    const last = ordered[ordered.length - 1] as Block;
    const span = Math.max(1, last.time - first.time);
    const maxTx = Math.max(1, ...ordered.map((b) => b.txCount));
    let path = `M${PAD} ${BASE}`;
    const xs: number[] = [];
    for (const b of ordered) {
      const x = PAD + 12 + ((b.time - first.time) / span) * (W - PAD * 2 - 30);
      xs.push(x);
      path += beat(x, 26 + 70 * (b.txCount / maxTx));
    }
    path += `L${W - PAD} ${BASE}`;
    const avgSec = span / (ordered.length - 1) / 1000;
    return { path, avgSec, bpm: 60 / avgSec, latest: last, xs };
  }, [data]);

  const latest = data?.[0];
  const ageSec = latest ? Math.max(0, Math.round((now - latest.time) / 1000)) : 0;
  const lastMinuteTx = (data ?? []).filter((b) => b.time >= now - 60_000).reduce((a, b) => a + b.txCount, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('navigation.heartbeat')}
        description={t('heartbeatPage.description', { chain: chain.name })}
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
        <StatCard icon={HeartPulse} label={t('heartbeatPage.rate')} value={model ? `${fmt.decimal(model.bpm, 1)} ${t('heartbeatPage.perMinute')}` : '–'} loading={isLoading} />
        <StatCard icon={Clock} label={t('heartbeatPage.sinceLast')} value={latest ? fmt.unit(ageSec, 'second', 'short', 0) : '–'} loading={isLoading} />
        <StatCard icon={Boxes} label={t('metrics.blockHeight.label')} value={latest ? fmt.integer(latest.height) : '–'} loading={isLoading} />
        <StatCard icon={Activity} label={t('heartbeatPage.txLastMinute')} value={fmt.integer(lastMinuteTx)} loading={isLoading} />
      </div>

      <Panel className="overflow-hidden p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-semibold">{t('heartbeatPage.monitor')}</h2>
          <span className="text-[11.5px] text-fg-3">{t('heartbeatPage.legend')}</span>
        </div>
        {isLoading ? (
          <Skeleton className="aspect-[1000/220] w-full" />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : !model ? (
          <EmptyState title={t('states.emptyTitle')} />
        ) : (
          <div className="relative rounded-xl border border-line bg-[linear-gradient(180deg,rgb(8_20_30/0.9),rgb(4_8_16/0.95))] light:bg-card" dir="ltr">
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t('heartbeatPage.chartLabel', { rate: fmt.decimal(model.bpm, 1), seconds: fmt.decimal(model.avgSec, 2) })}>
              <defs>
                <filter id={`${uid}-glow`} x="-5%" y="-30%" width="110%" height="160%">
                  <feGaussianBlur stdDeviation="4" />
                </filter>
                <linearGradient id={`${uid}-sweep`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" stopColor="var(--c-green)" stopOpacity="0" />
                  <stop offset="1" stopColor="var(--c-green)" stopOpacity="0.28" />
                </linearGradient>
              </defs>
              {Array.from({ length: 9 }, (_, i) => (
                <line key={`v${i}`} x1={PAD + (i * (W - PAD * 2)) / 8} x2={PAD + (i * (W - PAD * 2)) / 8} y1="14" y2={H - 14} stroke="var(--c-line)" strokeOpacity="0.55" strokeDasharray="2 7" />
              ))}
              {[48, 88, 128, 168].map((y) => (
                <line key={y} x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="var(--c-line)" strokeOpacity={y === BASE ? 0.9 : 0.45} strokeDasharray={y === BASE ? undefined : '2 7'} />
              ))}
              <path d={model.path} fill="none" stroke="var(--c-green)" strokeWidth="7" strokeLinejoin="round" opacity="0.45" filter={`url(#${uid}-glow)`} />
              <path d={model.path} fill="none" stroke="var(--c-green)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="chart-draw" />
              {!reduced ? <rect className="hb-sweep" x={PAD} y="10" width="120" height={H - 20} fill={`url(#${uid}-sweep)`} /> : null}
            </svg>
          </div>
        )}
      </Panel>

      <Panel className="p-4">
        <h2 className="mb-2 font-display text-[15px] font-semibold">{t('heartbeatPage.stream')}</h2>
        <ul className="divide-y divide-line" aria-live="off">
          {isLoading
            ? Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="py-2">
                  <Skeleton className="h-8" />
                </li>
              ))
            : (data ?? []).slice(0, 8).map((b, i) => (
                <li key={b.height} className={i === 0 ? 'animate-rise' : undefined}>
                  <Link to={`/blocks/${b.height}`} className="flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-hover/50">
                    <span className="flex items-center gap-3">
                      <span className="size-2 rounded-full bg-green" style={{ opacity: 1 - i * 0.1 }} aria-hidden />
                      <span className="font-medium tabular-nums text-cyan">{fmt.integer(b.height)}</span>
                      <span className="hidden text-[12px] text-fg-3 sm:inline">{b.proposer.moniker}</span>
                    </span>
                    <span className="flex items-center gap-4 text-[12px] tabular-nums text-fg-3">
                      <span>{t('heartbeatPage.txCount', { count: b.txCount })}</span>
                      <span>{fmt.relative(b.time, now)}</span>
                    </span>
                  </Link>
                </li>
              ))}
        </ul>
      </Panel>
    </div>
  );
}
