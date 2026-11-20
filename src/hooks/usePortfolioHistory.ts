import { useQueries } from '@tanstack/react-query';
import { provider } from '@/services/chain';
import type { HistoryPoint } from '@/types/domain';

/**
 * Value (USD) of the CURRENT holdings at each point of the last 30 days of simulated prices. It does not replay past
 * balances — it answers "what would these holdings have been worth" — and the page says so.
 */
export function usePortfolioHistory(holdings: Readonly<Record<string, number>>): { data: HistoryPoint[]; isLoading: boolean } {
  const symbols = Object.keys(holdings).filter((s) => (holdings[s] ?? 0) > 0);
  return useQueries({
    queries: symbols.map((symbol) => ({
      queryKey: [provider.id, 'price-history', symbol, '30D'] as const,
      queryFn: ({ signal }: { signal: AbortSignal }) => provider.getPriceHistory(symbol, '30D', { signal }),
      staleTime: 60_000,
    })),
    combine: (results) => {
      if (results.some((r) => r.isLoading)) return { data: [], isLoading: true };
      const series = results.map((r, i) => ({ amount: holdings[symbols[i] as string] ?? 0, points: r.data ?? [] }));
      const length = Math.min(...series.map((s) => s.points.length));
      if (!Number.isFinite(length) || length === 0) return { data: [], isLoading: false };
      const data = Array.from({ length }, (_, k) => ({
        t: series[0]?.points[k]?.t ?? 0,
        v: series.reduce((sum, s) => sum + s.amount * (s.points[k]?.v ?? 0), 0),
      }));
      return { data, isLoading: false };
    },
  });
}
