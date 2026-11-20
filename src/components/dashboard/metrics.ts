import { ArrowLeftRight, Box, Coins, DollarSign, Landmark, Layers, Lock, Percent, Timer, TrendingUp, type LucideIcon } from 'lucide-react';
import type { Formatter } from '@/lib/format';
import type { ChainMetrics, MetricKey } from '@/types/domain';

export interface MetricDef {
  key: MetricKey;
  icon: LucideIcon;
  /** Headline value for the card. */
  value: (m: ChainMetrics, f: Formatter) => string;
  /** Extra rows shown in the detail dialog. */
  details?: (m: ChainMetrics, f: Formatter) => Array<{ labelKey: string; value: string }>;
  /** Whether a positive change is "good" (green) or just informational (neutral). */
  tone: 'signed' | 'neutral';
  /** Raw number + unit for CSV export. */
  raw: (m: ChainMetrics) => { value: number; unit: string };
}

/** The ten On-chain Metrics cards. Every value is derived from one coherent model (see demo/model.ts). */
export const METRIC_DEFS: readonly MetricDef[] = [
  {
    key: 'blockHeight',
    icon: Box,
    value: (m, f) => f.integer(m.blockHeight),
    tone: 'neutral',
    raw: (m) => ({ value: m.blockHeight, unit: 'blocks' }),
  },
  {
    key: 'totalTransactions',
    icon: ArrowLeftRight,
    value: (m, f) => f.compact(m.totalTransactions, 2),
    details: (m, f) => [{ labelKey: 'metrics.exact', value: f.integer(m.totalTransactions) }],
    tone: 'signed',
    raw: (m) => ({ value: Math.round(m.totalTransactions), unit: 'transactions' }),
  },
  {
    key: 'txPerBlock',
    icon: Layers,
    value: (m, f) => f.decimal(m.txPerBlock, 2),
    tone: 'neutral',
    raw: (m) => ({ value: Number(m.txPerBlock.toFixed(2)), unit: 'tx/block' }),
  },
  {
    key: 'blockTime',
    icon: Timer,
    value: (m, f) => f.seconds(m.blockTimeSec, 2),
    tone: 'neutral',
    raw: (m) => ({ value: Number(m.blockTimeSec.toFixed(2)), unit: 's' }),
  },
  {
    key: 'inflation',
    icon: Percent,
    value: (m, f) => f.percent(m.inflation, 2),
    tone: 'neutral',
    raw: (m) => ({ value: Number((m.inflation * 100).toFixed(2)), unit: '%' }),
  },
  {
    key: 'stakingApr',
    icon: TrendingUp,
    value: (m, f) => f.percent(m.stakingApr, 2),
    details: (m, f) => [
      { labelKey: 'metrics.inputInflation', value: f.percent(m.inflation, 2) },
      { labelKey: 'metrics.inputTax', value: f.percent(m.communityTax, 2) },
      { labelKey: 'metrics.inputBonded', value: f.percent(m.bondedRatio, 2) },
    ],
    tone: 'neutral',
    raw: (m) => ({ value: Number((m.stakingApr * 100).toFixed(2)), unit: '%' }),
  },
  {
    key: 'bondedTokens',
    icon: Lock,
    value: (m, f) => f.compact(m.bondedTokens, 2),
    details: (m, f) => [
      { labelKey: 'metrics.bondedRatio', value: f.percent(m.bondedRatio, 2) },
      { labelKey: 'metrics.exact', value: f.token(m.bondedTokens, m.symbol, 0) },
    ],
    tone: 'signed',
    raw: (m) => ({ value: Math.round(m.bondedTokens), unit: m.symbol }),
  },
  {
    key: 'totalSupply',
    icon: Coins,
    value: (m, f) => f.compact(m.totalSupply, 2),
    details: (m, f) => [{ labelKey: 'metrics.exact', value: f.token(m.totalSupply, m.symbol, 0) }],
    tone: 'signed',
    raw: (m) => ({ value: Math.round(m.totalSupply), unit: m.symbol }),
  },
  {
    key: 'communityPool',
    icon: Landmark,
    value: (m, f) => f.compact(m.communityPool, 2),
    details: (m, f) => [{ labelKey: 'metrics.poolShare', value: f.percent(m.communityPoolShare, 2) }],
    tone: 'signed',
    raw: (m) => ({ value: Math.round(m.communityPool), unit: m.symbol }),
  },
  {
    key: 'poolValue',
    icon: DollarSign,
    value: (m, f) => f.usdCompact(m.poolValueUsd),
    details: (m, f) => [
      { labelKey: 'metrics.tokenPrice', value: f.currency(m.priceUsd, 'USD', { maximumFractionDigits: m.priceUsd < 1 ? 4 : 2 }) },
    ],
    tone: 'signed',
    raw: (m) => ({ value: Math.round(m.poolValueUsd), unit: 'USD' }),
  },
];

export const getMetricDef = (key: MetricKey): MetricDef => METRIC_DEFS.find((d) => d.key === key) as MetricDef;
