import { unit } from '@/lib/prng';
import type { ChainConfig } from '@/types/domain';
import { accountAddress } from './ids';

/**
 * A fixed pool of simulated accounts per chain. Every simulated transaction's sender and receiver is one of
 * them, so an address seen in the Transactions table is the same account whose page lists that transaction.
 * (The pool is deliberately small and skewed — a few busy accounts, a long tail — like real chains.)
 */
export const POOL_SIZE = 240;

interface Pool {
  list: string[];
  index: Map<string, number>;
}
const cache = new Map<string, Pool>();

function pool(c: ChainConfig): Pool {
  let p = cache.get(c.id);
  if (!p) {
    const list = Array.from({ length: POOL_SIZE }, (_, i) => accountAddress(c.bech32Prefix, c.id, 'pool', i));
    p = { list, index: new Map(list.map((a, i) => [a, i])) };
    cache.set(c.id, p);
  }
  return p;
}

export const poolAddress = (c: ChainConfig, i: number): string => pool(c).list[i] as string;

/** Pool position of an address, or -1 when it is not one of the simulated accounts. */
export const poolIndexOf = (c: ChainConfig, address: string): number => pool(c).index.get(address) ?? -1;

/** Skewed pick (exponent > 1 favours low indexes): account 0 is the busiest. */
function skewed(c: ChainConfig, height: number, index: number, role: 'from' | 'to'): number {
  return Math.min(POOL_SIZE - 1, Math.floor(POOL_SIZE * Math.pow(unit('who', c.id, height, index, role), 1.6)));
}

/** Sender and receiver (pool positions) of the transaction in slot (height, index). Cheap: two hashes. */
export function participantsAt(c: ChainConfig, height: number, index: number): { from: number; to: number } {
  const from = skewed(c, height, index, 'from');
  let to = skewed(c, height, index, 'to');
  if (to === from) to = (to + 1) % POOL_SIZE; // never send to yourself
  return { from, to };
}
