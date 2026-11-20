import { useMemo } from 'react';
import { useMarket } from './useChainData';

/** Latest simulated USD price per asset symbol, derived from the market query (so there is one source of truth). */
export function usePrices(): { prices: Record<string, number>; isLoading: boolean } {
  const { data, isLoading } = useMarket();
  const prices = useMemo(() => Object.fromEntries((data ?? []).map((row) => [row.symbol, row.priceUsd])), [data]);
  return { prices, isLoading };
}
