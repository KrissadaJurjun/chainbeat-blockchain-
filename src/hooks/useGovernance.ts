import { useMemo } from 'react';
import { applyDemoVote, isVoteOption, mergeDemoProposals, GOV_PARAMS, type VoteOption } from '@/lib/governance';
import { deriveDemoAddress } from '@/services/wallet/adapters';
import { useChain } from '@/stores/chainStore';
import { useWalletStore } from '@/stores/walletStore';
import type { ProposalDetail } from '@/types/domain';
import { useMetrics, useRawProposalDetail, useRawProposals } from './useChainData';

/**
 * How many tokens the Demo wallet's vote counts for. A real network counts only STAKED tokens; the simulation
 * counts the whole balance of the network's token (held + delegated) so that a demo vote visibly moves the tally.
 */
export function useVoteWeight(): number {
  const chain = useChain();
  const balance = useWalletStore((s) => s.ledger.balances[chain.symbol] ?? 0);
  const delegations = useWalletStore((s) => s.ledger.delegations);
  return balance + delegations.filter((d) => d.chainId === chain.id).reduce((a, d) => a + d.amount, 0);
}

/** The option the Demo wallet voted for on a proposal, if any. */
export function useMyVote(id: number): VoteOption | undefined {
  const chain = useChain();
  const option = useWalletStore((s) => s.ledger.votes[chain.id + ':' + id]);
  return isVoteOption(option) ? option : undefined;
}

/** The network's proposals, with the proposals drafted in Demo Mode added and the Demo wallet's votes counted. */
export function useProposals() {
  const chain = useChain();
  const query = useRawProposals();
  const bonded = useMetrics().data?.bondedTokens ?? 0;
  const demo = useWalletStore((s) => s.ledger.proposals);
  const votes = useWalletStore((s) => s.ledger.votes);
  const weight = useVoteWeight();

  const data = useMemo(() => {
    if (!query.data) return undefined;
    const minDeposit = query.data.items[0]?.minDeposit ?? Math.max(100, Math.round(5000 / chain.basePriceUsd / 100) * 100);
    const merged = mergeDemoProposals(query.data, demo, chain, minDeposit, deriveDemoAddress(chain));
    const items = merged.items.map((p) => {
      const option = votes[chain.id + ':' + p.id];
      return applyDemoVote(p, isVoteOption(option) ? option : undefined, weight, bonded);
    });
    return { ...merged, items };
  }, [query.data, demo, votes, weight, bonded, chain]);
  return { ...query, data };
}

/** One proposal with its tally parameters; works for network proposals and for the ones drafted in Demo Mode. */
export function useProposalDetail(id: number) {
  const chain = useChain();
  const isDemo = id > chain.proposalsTotal;
  const raw = useRawProposalDetail(isDemo ? 0 : id);
  const all = useProposals();
  const bonded = useMetrics().data?.bondedTokens ?? 0;
  const votes = useWalletStore((s) => s.ledger.votes);
  const weight = useVoteWeight();

  const detail = useMemo<ProposalDetail | null | undefined>(() => {
    const option = votes[chain.id + ':' + id];
    if (isDemo) {
      if (!all.data) return undefined;
      const proposal = all.data.items.find((p) => p.id === id);
      return proposal ? { proposal, bondedTokens: bonded, ...GOV_PARAMS, voters: option ? 1 : 0 } : null;
    }
    if (raw.data === undefined || raw.data === null) return raw.data;
    const proposal = applyDemoVote(raw.data.proposal, isVoteOption(option) ? option : undefined, weight, raw.data.bondedTokens || bonded);
    return { ...raw.data, proposal, voters: raw.data.voters + (option ? 1 : 0) };
  }, [isDemo, all.data, raw.data, votes, weight, bonded, chain.id, id]);

  const source = isDemo ? all : raw;
  return { data: detail, isLoading: source.isLoading, isError: source.isError, refetch: source.refetch, isFetching: source.isFetching };
}
