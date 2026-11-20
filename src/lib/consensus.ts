import type { Validator } from '@/types/domain';

/**
 * Fewest validators (by voting power, descending) whose combined power exceeds `threshold`.
 * threshold = 1/3 is the classic "Nakamoto coefficient": enough stake to halt a BFT chain.
 */
export function powerCoefficient(validators: readonly Validator[], threshold: number): number {
  const active = validators.filter((v) => v.status === 'active').sort((a, b) => b.votingPower - a.votingPower);
  let cumulative = 0;
  for (let i = 0; i < active.length; i++) {
    cumulative += (active[i] as Validator).votingPower;
    if (cumulative > threshold) return i + 1;
  }
  return active.length;
}

/** Herfindahl–Hirschman index of voting power on a 0‥10,000 scale (higher = more concentrated). */
export function hhi(validators: readonly Validator[]): number {
  return validators.filter((v) => v.status === 'active').reduce((sum, v) => sum + (v.votingPower * 100) ** 2, 0);
}
