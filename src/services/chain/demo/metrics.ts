import { slowNoise } from '@/lib/noise';
import { DAY_MS, HOUR_MS } from '@/lib/utils';
import type { ChainConfig, ChainMetrics, HistoryPoint, MetricKey, NetworkStats } from '@/types/domain';
import { blockAt, blockTime, heightAt, meanTxAt, txCountAt, txsForBlock } from './blocks';
import { bondedRatioAt, bondedTokensAt, communityPoolAt, inflationAt, stakingAprAt, supplyAt } from './model';
import { priceAt } from './prices';

const WINDOW = 100;

/** Average block time and tx/block measured over the 100 blocks ending at time `t` — the same blocks the explorer lists. */
function measured(c: ChainConfig, t: number): { blockTimeSec: number; txPerBlock: number } {
  const tip = heightAt(c, t);
  let tx = 0;
  for (let k = 0; k < WINDOW; k++) tx += txCountAt(c, tip - k);
  return { blockTimeSec: (blockTime(c, tip) - blockTime(c, tip - WINDOW)) / WINDOW / 1000, txPerBlock: tx / WINDOW };
}

export function metricValue(c: ChainConfig, key: MetricKey, t: number): number {
  switch (key) {
    case 'blockHeight':
      return heightAt(c, t);
    case 'totalTransactions':
      return c.totalTxAtTarget + (heightAt(c, t) - c.heightAtTarget) * c.txPerBlock;
    case 'txPerBlock':
      return measured(c, t).txPerBlock;
    case 'blockTime':
      return measured(c, t).blockTimeSec;
    case 'inflation':
      return inflationAt(c, t);
    case 'stakingApr':
      return stakingAprAt(c, t);
    case 'bondedTokens':
      return bondedTokensAt(c, t);
    case 'totalSupply':
      return supplyAt(c, t);
    case 'communityPool':
      return communityPoolAt(c, t);
    case 'poolValue':
      return communityPoolAt(c, t) * priceAt(c.symbol, t);
  }
}

const KEYS: readonly MetricKey[] = [
  'blockHeight', 'totalTransactions', 'txPerBlock', 'blockTime', 'inflation',
  'stakingApr', 'bondedTokens', 'totalSupply', 'communityPool', 'poolValue',
];

export function buildMetrics(c: ChainConfig, now: number): ChainMetrics {
  const prev = now - DAY_MS;
  const trend24h: Partial<Record<MetricKey, number>> = {};
  for (const key of KEYS) {
    const a = metricValue(c, key, now);
    const b = metricValue(c, key, prev);
    trend24h[key] = key === 'blockHeight' ? a - b : b === 0 ? 0 : a / b - 1;
  }
  const supply = supplyAt(c, now);
  const pool = communityPoolAt(c, now);
  const price = priceAt(c.symbol, now);
  const m = measured(c, now);
  return {
    chainId: c.id,
    symbol: c.symbol,
    asOf: now,
    blockHeight: heightAt(c, now),
    totalTransactions: metricValue(c, 'totalTransactions', now),
    txPerBlock: m.txPerBlock,
    blockTimeSec: m.blockTimeSec,
    inflation: inflationAt(c, now),
    stakingApr: stakingAprAt(c, now),
    bondedTokens: bondedTokensAt(c, now),
    bondedRatio: bondedRatioAt(c, now),
    totalSupply: supply,
    communityPool: pool,
    communityPoolShare: pool / supply,
    poolValueUsd: pool * price,
    priceUsd: price,
    communityTax: c.communityTax,
    trend24h,
  };
}

/** Hourly history of one metric over the last `points` hours (oldest first). */
export function metricHistory(c: ChainConfig, key: MetricKey, now: number, points = 24): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const t = now - i * HOUR_MS;
    out.push({ t, v: metricValue(c, key, t) });
  }
  return out;
}

export function buildNetworkStats(c: ChainConfig, now: number): NetworkStats {
  const tip = heightAt(c, now);
  const blockTimes: NetworkStats['blockTimes'] = [];
  const txPerBlock: NetworkStats['txPerBlock'] = [];
  const gasUsage: NetworkStats['gasUsage'] = [];
  const txOutcome = { ok: 0, failed: 0 };
  for (let h = tip - 59; h <= tip; h++) {
    blockTimes.push({ height: h, sec: (blockTime(c, h) - blockTime(c, h - 1)) / 1000 });
    txPerBlock.push({ height: h, tx: txCountAt(c, h) });
    const block = blockAt(c, h);
    gasUsage.push({ height: h, used: block.gasUsed, limit: block.gasLimit });
    for (const tx of txsForBlock(c, h)) {
      if (tx.status === 'success') txOutcome.ok++;
      else txOutcome.failed++;
    }
  }
  const bondedHistory: NetworkStats['bondedHistory'] = [];
  for (let d = 29; d >= 0; d--) {
    const t = now - d * DAY_MS;
    bondedHistory.push({ t, ratio: bondedRatioAt(c, t), apr: stakingAprAt(c, t) });
  }
  const uptime = 0.9985 + 0.0013 * (0.5 + 0.5 * slowNoise(`uptime:${c.id}`)(now) / 2);
  return {
    blockTimes,
    txPerBlock,
    bondedHistory,
    gasUsage,
    txOutcome,
    params: [
      { key: 'inflation', value: inflationAt(c, now), unit: 'percent' },
      { key: 'communityTax', value: c.communityTax, unit: 'percent' },
      { key: 'bondedRatio', value: bondedRatioAt(c, now), unit: 'percent' },
      { key: 'activeValidators', value: c.activeValidators, unit: 'count' },
      { key: 'unbonding', value: c.unbondingDays, unit: 'days' },
      { key: 'votingPeriod', value: c.votingPeriodDays, unit: 'days' },
      { key: 'blockTime', value: measured(c, now).blockTimeSec, unit: 'seconds' },
      { key: 'ibcChannels', value: c.ibcChannels, unit: 'count' },
    ],
    uptime,
    activeValidators: c.activeValidators,
    peers: 38 + Math.round(24 * (0.5 + 0.5 * Math.sin(now / 3_600_000))),
  };
}

/** Exposed for tests and the Network page: nominal vs measured average tx/block. */
export const nominalTxPerBlock = (c: ChainConfig, t: number): number => meanTxAt(c, t);
