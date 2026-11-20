import { checkAddress } from '@/lib/bech32';
import { rngFor } from '@/lib/prng';
import type { AccountData, AccountInfo, ChainConfig, Tx } from '@/types/domain';
import { hasRecipient, heightAt, txAt, txCountAt, txTypeAt } from './blocks';
import { participantsAt, poolIndexOf } from './pool';
import { priceAt } from './prices';

/** How many of the newest blocks are scanned for an account's activity (~6.5 h at 6 s blocks). */
export const ACCOUNT_WINDOW_BLOCKS = 4000;
const DEFAULT_LIMIT = 100;

/** Is this a syntactically valid account address for the chain (right prefix, valid checksum)? */
export const isAccountAddress = (c: ChainConfig, address: string): boolean => checkAddress(address, c.bech32Prefix).ok;

/** Simulated balance sheet of a pool account (deterministic; busier accounts are richer). */
function balancesFor(c: ChainConfig, index: number, now: number): Pick<AccountInfo, 'balances' | 'staked' | 'rewards' | 'totalValueUsd'> {
  const rng = rngFor('acct-bal', c.id, index);
  const native = Math.round((1500 / Math.pow(index + 1, 0.85)) * (0.6 + rng()) * 100) / 100 + 2;
  const nativePrice = priceAt(c.symbol, now);
  const usdc = Math.round(native * nativePrice * (0.05 + rng() * 0.3) * 100) / 100;
  const otherSymbol = c.symbol === 'ATOM' ? 'OSMO' : 'ATOM';
  const other = Math.round(native * (0.1 + rng() * 0.6) * 100) / 100;
  const staked = Math.round(native * (0.25 + rng() * 0.5) * 100) / 100;
  const rewards = Math.round(staked * (0.0004 + rng() * 0.0016) * 1e6) / 1e6;
  const balances = [
    { symbol: c.symbol, amount: native, usd: native * nativePrice },
    { symbol: 'USDC', amount: usdc, usd: usdc },
    { symbol: otherSymbol, amount: other, usd: other * priceAt(otherSymbol, now) },
  ];
  return { balances, staked, rewards, totalValueUsd: balances.reduce((a, b) => a + b.usd, 0) + staked * nativePrice + rewards * nativePrice };
}

/**
 * Account page data. Returns null for an address that is not valid on this chain. A valid address that the
 * simulation does not know is returned with no balances and no activity (`kind: 'unknown'`).
 *
 * `around` extends the scan to ±1 500 blocks around a height — used when arriving from an older transaction.
 */
export function accountData(c: ChainConfig, address: string, now: number, opts: { around?: number; limit?: number } = {}): AccountData | null {
  if (!isAccountAddress(c, address)) return null;
  const index = poolIndexOf(c, address);
  const base = { address, chainId: c.id, windowBlocks: ACCOUNT_WINDOW_BLOCKS };
  if (index < 0) {
    return { account: { ...base, kind: 'unknown', label: null, balances: [], staked: 0, rewards: 0, totalValueUsd: 0, txCount: 0 }, txs: [] };
  }

  const tip = heightAt(c, now);
  const ranges: Array<[number, number]> = [[Math.max(1, tip - ACCOUNT_WINDOW_BLOCKS + 1), tip]];
  if (opts.around) ranges.push([Math.max(1, opts.around - 1500), Math.min(tip, opts.around + 1500)]);

  const seen = new Set<number>();
  const slots: Array<[number, number]> = [];
  for (const [lo, hi] of ranges) {
    for (let h = hi; h >= lo; h--) {
      const n = txCountAt(c, h);
      for (let k = n - 1; k >= 0; k--) {
        const key = h * 4096 + k;
        if (seen.has(key)) continue;
        const who = participantsAt(c, h, k);
        if (who.from === index || (who.to === index && hasRecipient(txTypeAt(c, h, k)))) {
          seen.add(key);
          slots.push([h, k]);
        }
      }
    }
  }
  slots.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const txs: Tx[] = slots.slice(0, opts.limit ?? DEFAULT_LIMIT).map(([h, k]) => txAt(c, h, k));
  return { account: { ...base, kind: 'pool', label: null, ...balancesFor(c, index, now), txCount: slots.length }, txs };
}
