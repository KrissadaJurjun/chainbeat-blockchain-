import { hashString, hexBytes, mulberry32 } from '@/lib/prng';
import { heightAt } from '@/services/chain/demo/blocks';
import type { ChainConfig, Tx, TxType } from '@/types/domain';

/**
 * Hashes of transactions created by the Demo wallet start with this marker, so they are recognisable as synthetic
 * (a real chain never "starts" a hash on purpose) and can never be confused with — or looked up as — a simulated
 * chain transaction.
 */
export const DEMO_TX_PREFIX = 'DE0DE0';
export const isDemoTxHash = (hash: string): boolean => hash.toUpperCase().startsWith(DEMO_TX_PREFIX);

/** Flat network fee the Demo wallet pays, in the network's native token. */
export const DEMO_FEE = 0.0025;

interface DemoTxInput {
  type: TxType;
  from: string;
  to?: string;
  amount: number;
  symbol: string;
  memo?: string;
  /** Any unique string (an activity id): the same seed always gives the same hash. */
  seed: string;
}

/** A synthetic transaction record for something the Demo wallet just did. It sits at the current simulated height. */
export function makeDemoTx(chain: ChainConfig, now: number, input: DemoTxInput): Tx {
  const rng = mulberry32(hashString('demo-tx|' + input.seed));
  const gasWanted = 150_000 + Math.floor(rng() * 90_000);
  return {
    hash: DEMO_TX_PREFIX + hexBytes(rng, 29),
    height: heightAt(chain, now),
    index: 0,
    time: now,
    type: input.type,
    status: 'success',
    from: input.from,
    to: input.to,
    amount: input.amount,
    symbol: input.symbol,
    feeAmount: DEMO_FEE,
    feeSymbol: chain.symbol,
    memo: input.memo ?? '',
    gasUsed: Math.round(gasWanted * (0.7 + rng() * 0.2)),
    gasWanted,
  };
}
