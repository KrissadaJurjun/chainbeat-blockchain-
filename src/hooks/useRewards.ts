import { useMemo } from 'react';
import { YEAR_MS } from '@/lib/utils';
import { getSimNow } from '@/stores/simStore';
import type { DemoDelegation } from '@/stores/walletStore';
import { useMultichain } from './useChainData';

export interface DelegationView extends DemoDelegation {
  symbol: string;
  chainName: string;
  /** Rewards accrued since the last claim, in the chain's native token. */
  rewards: number;
  rewardsUsd: number;
  valueUsd: number;
}

/**
 * Simulated staking rewards: stake × chain staking APR × time since the last claim. The per-chain APR and
 * price come from the multichain query, so every network a delegation lives on is priced correctly.
 */
export function useDelegationViews(delegations: readonly DemoDelegation[]): { views: DelegationView[]; rewardsUsd: number; stakedUsd: number; isLoading: boolean } {
  const { data, isLoading } = useMultichain();
  return useMemo(() => {
    const now = getSimNow();
    const views = delegations.map<DelegationView>((d) => {
      const row = data?.find((r) => r.id === d.chainId);
      const apr = row?.stakingApr ?? 0;
      const price = row?.priceUsd ?? 0;
      const elapsed = Math.max(0, now - d.since);
      const rewards = d.amount * apr * (elapsed / YEAR_MS);
      return { ...d, symbol: row?.symbol ?? '', chainName: row?.name ?? d.chainId, rewards, rewardsUsd: rewards * price, valueUsd: d.amount * price };
    });
    return {
      views,
      rewardsUsd: views.reduce((a, v) => a + v.rewardsUsd, 0),
      stakedUsd: views.reduce((a, v) => a + v.valueUsd, 0),
      isLoading,
    };
  }, [delegations, data, isLoading]);
}
