import { SIM_TARGET_MS, priceNoise } from '@/lib/noise';
import { rngFor } from '@/lib/prng';
import { DAY_MS, HOUR_MS, YEAR_MS } from '@/lib/utils';
import type {
  AccentColor,
  HistoryPoint,
  MarketRow,
  OverviewData,
  OverviewPoint,
  OverviewSeriesMeta,
  OverviewStat,
  Range,
} from '@/types/domain';
import { ASSETS, getAsset } from '../registry';

/**
 * Simulated prices. `priceAt(symbol, t)` is a pure function of time: it equals the configured base
 * price at SIM_TARGET_MS and wanders deterministically around it. Assets share a "market factor"
 * (scaled by beta) so they are plausibly correlated — BTC moves less than OSMO, etc.
 */

const targetLog = new Map<string, number>();

function rawLogPrice(symbol: string, t: number): number {
  const a = getAsset(symbol);
  if (a.kind === 'stable') return 0.0015 * priceNoise(`stable:${symbol}`)(t);
  const market = priceNoise('market')(t);
  const idio = priceNoise(`asset:${symbol}`)(t);
  return a.vol * (0.55 * a.beta * market + 0.83 * idio);
}

function targetLogPrice(symbol: string): number {
  let v = targetLog.get(symbol);
  if (v === undefined) {
    v = rawLogPrice(symbol, SIM_TARGET_MS);
    targetLog.set(symbol, v);
  }
  return v;
}

/** Staking derivatives accrue rewards, so 1 stX is worth a growing amount of X. */
export function liquidRatioAt(t: number): number {
  return 1.128 + (0.17 * (t - SIM_TARGET_MS)) / YEAR_MS;
}

export function priceAt(symbol: string, t: number): number {
  const a = getAsset(symbol);
  if (a.kind === 'liquid') return priceAt(symbol.replace(/^st/, ''), t) * liquidRatioAt(t);
  return a.basePriceUsd * Math.exp(rawLogPrice(symbol, t) - targetLogPrice(symbol));
}

/* ───────────────────────── Overview chart ───────────────────────── */

const OVERVIEW_SERIES: readonly OverviewSeriesMeta[] = [
  { id: 'ATOM', symbol: 'ATOM', name: 'Cosmos Hub', color: 'purple' },
  { id: 'OSMO', symbol: 'OSMO', name: 'Osmosis', color: 'cyan' },
  { id: 'BTC', symbol: 'BTC', name: 'Bitcoin', color: 'yellow' },
];

const RANGE_SPEC: Record<Range, { span: number; step: number }> = {
  '24H': { span: DAY_MS, step: 15 * 60_000 },
  '7D': { span: 7 * DAY_MS, step: HOUR_MS },
  '30D': { span: 30 * DAY_MS, step: 6 * HOUR_MS },
  '90D': { span: 90 * DAY_MS, step: DAY_MS },
};

/** Number of points `buildOverview` returns for a range (exported for tests and skeletons). */
export const overviewPointCount = (range: Range): number => RANGE_SPEC[range].span / RANGE_SPEC[range].step + 1;

export function buildOverview(range: Range, now: number): OverviewData {
  const { span, step } = RANGE_SPEC[range];
  const end = Math.floor(now / step) * step;
  const count = span / step + 1;
  const start = end - span;
  const symbols = OVERVIEW_SERIES.map((s) => s.symbol);
  const startPrices = symbols.map((s) => priceAt(s, start));

  const points: OverviewPoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = start + i * step;
    const p = symbols.map((s) => priceAt(s, t));
    const v = p.map((price, k) => (100 * price) / (startPrices[k] as number));
    points.push({ t, v, p });
  }

  const stats: OverviewStat[] = OVERVIEW_SERIES.map((s, k) => {
    const values = points.map((pt) => pt.v[k] as number);
    const last = points[points.length - 1] as OverviewPoint;
    return {
      id: s.id,
      change: (last.v[k] as number) / 100 - 1,
      high: Math.max(...values),
      low: Math.min(...values),
      lastIndex: last.v[k] as number,
      lastPrice: last.p[k] as number,
    };
  });

  return { range, base: 100, series: [...OVERVIEW_SERIES], points, stats, asOf: end };
}

/* ───────────────────────── Market ───────────────────────── */

export function buildMarket(now: number): MarketRow[] {
  const step = 4 * HOUR_MS;
  return ASSETS.map((a) => {
    const price = priceAt(a.symbol, now);
    const spark: number[] = [];
    for (let i = 41; i >= 0; i--) spark.push(priceAt(a.symbol, now - i * step));
    const marketCapUsd = price * a.circulating;
    const volShare = 0.025 + 0.09 * hashUnit(a.symbol);
    return {
      symbol: a.symbol,
      name: a.name,
      kind: a.kind,
      color: a.color as AccentColor,
      priceUsd: price,
      change24h: price / priceAt(a.symbol, now - DAY_MS) - 1,
      change7d: price / priceAt(a.symbol, now - 7 * DAY_MS) - 1,
      marketCapUsd,
      volume24hUsd: marketCapUsd * volShare,
      spark,
    };
  });
}

function hashUnit(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 1000;
  return h / 1000;
}

/**
 * Simulated traded volume per bucket (USD): a slice of the asset's daily volume that swells when the price moves
 * more, with a little deterministic wobble. Same buckets as `buildPriceHistory`.
 */
export function buildVolumeHistory(symbol: string, range: Range, now: number): HistoryPoint[] {
  const asset = getAsset(symbol);
  const prices = buildPriceHistory(symbol, range, now);
  const daily = priceAt(symbol, now) * asset.circulating * (0.025 + 0.09 * hashUnit(symbol));
  const { step } = RANGE_SPEC[range];
  return prices.map((p, i) => {
    const move = Math.abs(p.v / (prices[i - 1]?.v ?? p.v) - 1);
    const wobble = 0.7 + 0.6 * rngFor('volume', symbol, p.t)();
    return { t: p.t, v: daily * (step / DAY_MS) * wobble * (1 + Math.min(12, move * 40)) };
  });
}

export function buildPriceHistory(symbol: string, range: Range, now: number): HistoryPoint[] {
  const { span, step } = RANGE_SPEC[range];
  const end = Math.floor(now / step) * step;
  const count = span / step + 1;
  const out: HistoryPoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = end - span + i * step;
    out.push({ t, v: priceAt(symbol, t) });
  }
  return out;
}
