import { SIM_TARGET_MS, slowNoiseFromTarget } from '@/lib/noise';
import { YEAR_MS, clamp } from '@/lib/utils';
import type { ChainConfig } from '@/types/domain';

/**
 * The tokenomics model. Every figure is derived from a few base parameters so the numbers can never
 * contradict each other:
 *
 *   bonded tokens  = total supply × bonded ratio
 *   staking APR    = inflation × (1 − community tax) ÷ bonded ratio
 *   community pool = base pool + supply × inflation × community tax × elapsed years
 *   pool value     = community pool × token price
 */

const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;

export function inflationAt(c: ChainConfig, t: number): number {
  return round4(c.inflation * (1 + 0.015 * slowNoiseFromTarget(`infl:${c.id}`)(t)));
}

export function bondedRatioAt(c: ChainConfig, t: number): number {
  return clamp(round4(c.bondedRatio * (1 + 0.012 * slowNoiseFromTarget(`bond:${c.id}`)(t))), 0.05, 0.95);
}

export function supplyAt(c: ChainConfig, t: number): number {
  return c.supplyAtTarget * (1 + (c.inflation * (t - SIM_TARGET_MS)) / YEAR_MS);
}

export function bondedTokensAt(c: ChainConfig, t: number): number {
  return supplyAt(c, t) * bondedRatioAt(c, t);
}

export function stakingAprAt(c: ChainConfig, t: number): number {
  return (inflationAt(c, t) * (1 - c.communityTax)) / bondedRatioAt(c, t);
}

export function communityPoolAt(c: ChainConfig, t: number): number {
  return c.communityPoolAtTarget + (c.supplyAtTarget * c.inflation * c.communityTax * (t - SIM_TARGET_MS)) / YEAR_MS;
}
