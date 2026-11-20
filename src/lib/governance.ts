import { DAY_MS } from '@/lib/utils';
import type { ChainConfig, Proposal, ProposalType, ProposalsData, Tally } from '@/types/domain';

export type VoteOption = keyof Tally;
export const VOTE_OPTIONS: readonly VoteOption[] = ['yes', 'no', 'abstain', 'veto'];
export const isVoteOption = (value: unknown): value is VoteOption => typeof value === 'string' && (VOTE_OPTIONS as readonly string[]).includes(value);

/** Network governance parameters (Cosmos SDK defaults): quorum of bonded tokens, pass threshold, veto threshold. */
export const GOV_PARAMS = { quorum: 0.334, threshold: 0.5, vetoThreshold: 0.334 } as const;

/** Structural shape of a proposal drafted in Demo Mode (kept here so this module has no store dependency). */
export interface DemoProposalLike {
  chainId: string;
  id: number;
  title: string;
  description: string;
  type: ProposalType;
  deposit: number;
  submittedAt: number;
  /** How long voting lasts; the network's voting period when absent (proposals saved before this option existed). */
  votingDays?: number;
}

/** A Demo-drafted proposal as the proposal list sees it: voting once the deposit reaches the minimum, otherwise still in the deposit stage. */
export function demoToProposal(d: DemoProposalLike, chain: ChainConfig, minDeposit: number, proposer: string): Proposal {
  return {
    id: d.id,
    title: d.title,
    summary: d.title,
    description: d.description,
    demo: true,
    type: d.type,
    status: d.deposit >= minDeposit ? 'voting' : 'deposit',
    submitTime: d.submittedAt,
    votingEnd: d.submittedAt + (d.votingDays ?? chain.votingPeriodDays) * DAY_MS,
    deposit: d.deposit,
    minDeposit,
    tally: { yes: 0, no: 0, abstain: 0, veto: 0 },
    turnout: 0,
    proposer,
  };
}

/** The network's proposals plus the ones drafted in Demo Mode on this network, newest (highest id) first. */
export function mergeDemoProposals(data: ProposalsData, demo: readonly DemoProposalLike[], chain: ChainConfig, minDeposit: number, proposer: string): ProposalsData {
  const mine = demo.filter((d) => d.chainId === chain.id).map((d) => demoToProposal(d, chain, minDeposit, proposer));
  if (mine.length === 0) return data;
  return {
    live: data.live + mine.filter((p) => p.status === 'voting').length,
    total: data.total + mine.length,
    items: [...mine, ...data.items].sort((a, b) => b.id - a.id),
  };
}

/** Token counts behind a tally: share of the votes cast x votes cast (turnout x bonded tokens). */
export function tallyTokens(p: Proposal, bondedTokens: number): Record<VoteOption, number> {
  const cast = p.turnout * bondedTokens;
  return { yes: p.tally.yes * cast, no: p.tally.no * cast, abstain: p.tally.abstain * cast, veto: p.tally.veto * cast };
}

/** The tally after counting one more vote of `weight` tokens for `option` (no change without an option or weight). */
export function applyDemoVote(p: Proposal, option: VoteOption | undefined, weight: number, bondedTokens: number): Proposal {
  if (!option || weight <= 0 || bondedTokens <= 0) return p;
  const cast = p.turnout * bondedTokens;
  const total = cast + weight;
  const share = (key: VoteOption): number => (p.tally[key] * cast + (key === option ? weight : 0)) / total;
  return { ...p, tally: { yes: share('yes'), no: share('no'), abstain: share('abstain'), veto: share('veto') }, turnout: total / bondedTokens };
}

/** Would the proposal pass on its current tally? (quorum met, Yes above the threshold among decisive votes, veto below its limit) */
export function projectedOutcome(p: Proposal): 'passing' | 'failing' | 'noQuorum' | 'vetoed' {
  if (p.turnout < GOV_PARAMS.quorum) return 'noQuorum';
  if (p.tally.veto > GOV_PARAMS.vetoThreshold) return 'vetoed';
  const decisive = p.tally.yes + p.tally.no + p.tally.veto;
  return decisive > 0 && p.tally.yes / decisive > GOV_PARAMS.threshold ? 'passing' : 'failing';
}
