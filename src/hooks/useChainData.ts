import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { provider } from '@/services/chain';
import { useChain } from '@/stores/chainStore';
import { useSimStore, type SimSpeed } from '@/stores/simStore';
import { useUiStore } from '@/stores/uiStore';
import type { MetricKey, Range, RepoPeriod } from '@/types/domain';
import { DAY_MS, HOUR_MS } from '@/lib/utils';

/** How often live-looking data re-reads the simulated chain (≈ one block). */
export const LIVE_REFRESH_MS = 6_000;

/** Effective polling interval for the user’s refresh preference: live, about every 30 s, or only when they ask (false). */
export function useRefreshMs(baseMs: number): number | false {
  const preference = useUiStore((s) => s.refresh);
  return preference === 'manual' ? false : preference === 'slow' ? Math.max(baseMs, 30_000) : baseMs;
}

const base = (chainId: string, name: string, ...rest: unknown[]) => [provider.id, chainId, name, ...rest] as const;

export function useNetworkInfo() {
  const every = useRefreshMs(LIVE_REFRESH_MS);
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'network-info'),
    queryFn: ({ signal }) => provider.getNetworkInfo(chain.id, { signal }),
    refetchInterval: every,
    placeholderData: keepPreviousData,
  });
}

export function useValidatorDetail(address: string) {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'validator', address),
    queryFn: ({ signal }) => provider.getValidatorDetails(chain.id, address, { signal }),
    staleTime: 60_000,
  });
}

export function useRawProposalDetail(id: number) {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'proposal', id),
    queryFn: ({ signal }) => provider.getProposalDetails(chain.id, id, { signal }),
    enabled: id > 0,
    staleTime: 60_000,
  });
}

/** An account's page data. `around` is the height of a transaction the visitor came from. */
export function useAccount(address: string, around?: number) {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'account', address, around ?? 0),
    queryFn: ({ signal }) => provider.getAccount(chain.id, address, { signal, around }),
    staleTime: 30_000,
  });
}

export function useMetrics() {
  const every = useRefreshMs(LIVE_REFRESH_MS);
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'metrics'),
    queryFn: ({ signal }) => provider.getMetrics(chain.id, { signal }),
    refetchInterval: every,
    placeholderData: keepPreviousData,
  });
}

export function useMetricHistory(key: MetricKey | null) {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'metric-history', key),
    queryFn: ({ signal }) => provider.getMetricHistory(chain.id, key as MetricKey, { signal }),
    enabled: key !== null,
    staleTime: HOUR_MS / 4,
  });
}

export function useOverview(range: Range) {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'overview', range),
    queryFn: ({ signal }) => provider.getOverview(chain.id, range, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useValidators() {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'validators'),
    queryFn: ({ signal }) => provider.getValidators(chain.id, { signal }),
    staleTime: 60_000,
  });
}

/** The network's own proposals. Use `useProposals` (hooks/useGovernance) for the lists the UI shows. */
export function useRawProposals() {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'proposals'),
    queryFn: ({ signal }) => provider.getProposals(chain.id, { signal }),
    staleTime: 60_000,
  });
}

export function useGovernanceStats() {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'governance-stats'),
    queryFn: ({ signal }) => provider.getGovernanceStats(chain.id, { signal }),
    staleTime: 60_000,
  });
}

export function useBlocks(limit: number) {
  const every = useRefreshMs(LIVE_REFRESH_MS);
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'blocks', limit),
    queryFn: ({ signal }) => provider.getBlocks(chain.id, limit, { signal }),
    refetchInterval: every,
    placeholderData: keepPreviousData,
  });
}

export function useBlock(height: number) {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'block', height),
    queryFn: ({ signal }) => provider.getBlock(chain.id, height, { signal }),
    staleTime: DAY_MS,
  });
}

export function useTransactions(limit: number, before?: number) {
  const every = useRefreshMs(LIVE_REFRESH_MS * 2);
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'transactions', limit, before ?? 'now'),
    queryFn: ({ signal }) => provider.getTransactions(chain.id, limit, { signal, before }),
    refetchInterval: before === undefined ? every : false,
    placeholderData: keepPreviousData,
  });
}

export function useTransaction(hash: string, enabled = true) {
  const chain = useChain();
  return useQuery({
    enabled,
    queryKey: base(chain.id, 'transaction', hash),
    queryFn: ({ signal }) => provider.getTransaction(chain.id, hash, { signal }),
    staleTime: DAY_MS,
  });
}

export function useDevActivity() {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'dev-activity'),
    queryFn: ({ signal }) => provider.getDevActivity(chain.id, { signal }),
    staleTime: HOUR_MS,
  });
}

export function useRepositories(period: RepoPeriod) {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'repos', period),
    queryFn: ({ signal }) => provider.getRepositories(chain.id, period, { signal }),
    placeholderData: keepPreviousData,
    staleTime: HOUR_MS,
  });
}

export function useMarket() {
  const every = useRefreshMs(30_000);
  return useQuery({
    queryKey: [provider.id, 'market'] as const,
    queryFn: ({ signal }) => provider.getMarket({ signal }),
    refetchInterval: every,
    placeholderData: keepPreviousData,
  });
}

export function usePriceHistory(symbol: string, range: Range) {
  return useQuery({
    queryKey: [provider.id, 'price-history', symbol, range] as const,
    queryFn: ({ signal }) => provider.getPriceHistory(symbol, range, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useVolumeHistory(symbol: string, range: Range, enabled = true) {
  return useQuery({
    queryKey: [provider.id, 'volume-history', symbol, range] as const,
    queryFn: ({ signal }) => provider.getVolumeHistory(symbol, range, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled,
  });
}

export function useDominanceTrend() {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'dominance-trend'),
    queryFn: ({ signal }) => provider.getDominanceTrend(chain.id, { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useNetworkStats() {
  const every = useRefreshMs(LIVE_REFRESH_MS * 5);
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'network-stats'),
    queryFn: ({ signal }) => provider.getNetworkStats(chain.id, { signal }),
    refetchInterval: every,
    placeholderData: keepPreviousData,
  });
}

export function useIbc() {
  return useQuery({
    queryKey: [provider.id, 'ibc'] as const,
    queryFn: ({ signal }) => provider.getIbc({ signal }),
    staleTime: 60_000,
  });
}

export function useMultichain() {
  return useQuery({
    queryKey: [provider.id, 'multichain'] as const,
    queryFn: ({ signal }) => provider.getMultichain({ signal }),
    staleTime: 60_000,
  });
}

export function useTokens() {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'tokens'),
    queryFn: ({ signal }) => provider.getTokens(chain.id, { signal }),
    staleTime: 60_000,
  });
}

export function useNotifications() {
  const chain = useChain();
  return useQuery({
    queryKey: base(chain.id, 'notifications'),
    queryFn: ({ signal }) => provider.getNotifications(chain.id, { signal }),
    staleTime: 60_000,
  });
}

export function useSearch(query: string) {
  const chain = useChain();
  const trimmed = query.trim();
  return useQuery({
    queryKey: base(chain.id, 'search', trimmed),
    queryFn: ({ signal }) => provider.search(chain.id, trimmed, { signal }),
    enabled: trimmed.length >= 1,
    staleTime: 30_000,
  });
}

/** Simulation controls. Changing the simulated clock invalidates every cached query so the UI re-reads it. */
export function useSimulationActions() {
  const qc = useQueryClient();
  return {
    advance: (ms: number): void => {
      useSimStore.getState().advance(ms);
      void qc.invalidateQueries();
    },
    reset: (): void => {
      useSimStore.getState().reset();
      void qc.invalidateQueries();
    },
    setSpeed: (speed: SimSpeed): void => {
      useSimStore.getState().setSpeed(speed);
      void qc.invalidateQueries();
    },
    setForceError: (value: boolean): void => {
      useSimStore.getState().setForceError(value);
      void qc.invalidateQueries();
    },
  };
}
