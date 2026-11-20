import { GOV_PARAMS } from '@/lib/governance';
import { pick, rngFor, randRange } from '@/lib/prng';
import { DAY_MS } from '@/lib/utils';
import type { ChainConfig, GovernanceStats, Proposal, ProposalDetail, ProposalStatus, ProposalsData, ProposalType, Tally } from '@/types/domain';
import { accountAddress } from './ids';
import { bondedTokensAt } from './model';

const TYPES: ProposalType[] = ['text', 'parameter', 'spend', 'upgrade', 'ibc'];

const TEMPLATES: Record<ProposalType, string[]> = {
  text: [
    'Signalling: prioritise interchain security in the 2027 roadmap',
    'Signalling: adopt a validator code of conduct',
    'Signalling: fund a public security-audit programme',
    'Signalling: publish quarterly treasury reports',
  ],
  parameter: [
    'Parameter change: raise the maximum validator set to {n}',
    'Parameter change: lower the minimum commission to {p}%',
    'Parameter change: shorten the voting period to {d} days',
    'Parameter change: adjust the community tax to {p}%',
  ],
  spend: [
    'Community pool spend: {k}k {sym} for developer-tooling grants',
    'Community pool spend: {k}k {sym} for validator security audits',
    'Community pool spend: {k}k {sym} for wallet UX research',
    'Community pool spend: {k}k {sym} for open data indexing',
  ],
  upgrade: [
    'Software upgrade v{a}.{b}.0 "{name}"',
    'Software upgrade v{a}.{b}.0 — state-machine performance release',
    'Software upgrade v{a}.{b}.0 — IBC v{a} compatibility',
  ],
  ibc: [
    'Enable IBC rate limits on {sym} transfers',
    'Register a new IBC channel for liquid-staking assets',
    'Update the IBC light client trusting period',
  ],
  // only proposals created in Demo Mode use this category; the generated ones (TYPES below) never do
  other: ['Community proposal: open discussion topic'],
};
const CODENAMES = ['Aurora', 'Beacon', 'Cinder', 'Dawn', 'Equinox', 'Flare'];

const MOTIVATION: Record<ProposalType, string> = {
  text: 'This is a signalling proposal: it changes no parameters and moves no funds, but records how the community feels about the topic.',
  parameter: 'The change adjusts one network parameter. Validators should review the effect on security, fees and block production before voting.',
  spend: 'The funds would be sent from the community pool to the recipient named in the proposal after the vote passes.',
  upgrade: 'Validators must upgrade their software before the upgrade height; nodes that do not will halt until they do.',
  ibc: 'The change affects how tokens move over IBC. Relayers and counterparty chains may need to update their configuration.',
  other: 'This proposal does not fit the other categories: read its description to see what it asks of the community.',
};

function fill(template: string, c: ChainConfig, rng: () => number): string {
  return template
    .replace('{n}', String(c.activeValidators + 10 * (1 + Math.floor(rng() * 4))))
    .replace('{p}', (1 + Math.floor(rng() * 8)).toString())
    .replace('{d}', (2 + Math.floor(rng() * 5)).toString())
    .replace('{k}', (20 + Math.floor(rng() * 480)).toString())
    .replace(/\{sym\}/g, c.symbol)
    .replace(/\{a\}/g, String(8 + Math.floor(rng() * 12)))
    .replace('{b}', String(Math.floor(rng() * 6)))
    .replace('{name}', pick(rng, CODENAMES));
}

function normalise(t: Tally): Tally {
  const sum = t.yes + t.no + t.abstain + t.veto;
  return { yes: t.yes / sum, no: t.no / sum, abstain: t.abstain / sum, veto: t.veto / sum };
}

const startOfDay = (t: number): number => Math.floor(t / DAY_MS) * DAY_MS;

export const QUORUM = GOV_PARAMS.quorum;
export const THRESHOLD = GOV_PARAMS.threshold;
export const VETO_THRESHOLD = GOV_PARAMS.vetoThreshold;

/** The proposal at position `k` counted from the newest (k = 0 is the latest). Works for any k up to `proposalsTotal`. */
export function proposalAt(c: ChainConfig, k: number, now: number): Proposal {
  const day = startOfDay(now);
  const period = c.votingPeriodDays * DAY_MS;
  const minDeposit = Math.max(100, Math.round(5000 / c.basePriceUsd / 100) * 100);
  const id = c.proposalsTotal - k;
  const rng = rngFor('proposal', c.id, id);
  const type = pick(rng, TYPES);
  const title = fill(pick(rng, TEMPLATES[type]), c, rng);
  const live = k < c.proposalsLive;

  let status: ProposalStatus;
  let votingEnd: number;
  let tally: Tally;
  let turnout: number;

  if (live) {
    status = 'voting';
    const remaining = (0.25 + 0.6 * ((k + 1) / (c.proposalsLive + 1)) + rng() * 0.1) * period;
    votingEnd = day + Math.round(remaining);
    const progress = 1 - (votingEnd - now) / period;
    tally = normalise({ yes: randRange(rng, 0.45, 0.8), no: randRange(rng, 0.06, 0.28), abstain: randRange(rng, 0.04, 0.16), veto: randRange(rng, 0.005, 0.06) });
    turnout = Math.min(0.9, 0.2 + Math.max(0, progress) * 0.38 + rng() * 0.05);
  } else {
    const roll = rng();
    status = roll < 0.72 ? 'passed' : roll < 0.92 ? 'rejected' : 'failed';
    votingEnd = day - (k - c.proposalsLive) * 5 * DAY_MS - Math.round(rng() * 3 * DAY_MS) - DAY_MS;
    if (status === 'passed') tally = normalise({ yes: randRange(rng, 0.62, 0.93), no: randRange(rng, 0.02, 0.2), abstain: randRange(rng, 0.02, 0.12), veto: randRange(rng, 0.001, 0.03) });
    else if (status === 'rejected') tally = normalise({ yes: randRange(rng, 0.12, 0.4), no: randRange(rng, 0.4, 0.7), abstain: randRange(rng, 0.03, 0.12), veto: randRange(rng, 0.02, 0.2) });
    else tally = normalise({ yes: randRange(rng, 0.3, 0.6), no: randRange(rng, 0.1, 0.3), abstain: randRange(rng, 0.1, 0.3), veto: randRange(rng, 0.005, 0.04) });
    turnout = status === 'failed' ? randRange(rng, 0.14, 0.32) : randRange(rng, 0.38, 0.72);
  }

  const rules =
    'Voting period: ' + c.votingPeriodDays + ' days. Quorum: ' + (QUORUM * 100).toFixed(1) + '% of bonded tokens. ' +
    'Passes with more than ' + THRESHOLD * 100 + '% Yes among votes that are not Abstain, unless No with Veto exceeds ' + (VETO_THRESHOLD * 100).toFixed(1) + '%.';
  const description = [title + '.', MOTIVATION[type], rules, 'Simulated proposal text for Demo Mode. It does not exist on-chain.'].join('\n\n');

  return {
    id,
    title,
    summary: title + '. Simulated proposal text for Demo Mode — it does not exist on-chain.',
    description,
    type,
    status,
    submitTime: votingEnd - period,
    votingEnd,
    deposit: minDeposit,
    minDeposit,
    tally,
    turnout,
    proposer: accountAddress(c.bech32Prefix, 'proposer', c.id, id),
  };
}

/** The most recent proposals (40 of them), newest first. */
export function buildProposals(c: ChainConfig, now: number): ProposalsData {
  const count = Math.min(40, c.proposalsTotal);
  return { live: c.proposalsLive, total: c.proposalsTotal, items: Array.from({ length: count }, (_, k) => proposalAt(c, k, now)) };
}

/** A proposal by its id, or null when the chain has no such proposal. */
export function proposalById(c: ChainConfig, id: number, now: number): Proposal | null {
  const k = c.proposalsTotal - id;
  if (!Number.isInteger(id) || k < 0 || k >= c.proposalsTotal) return null;
  return proposalAt(c, k, now);
}

export function proposalDetail(c: ChainConfig, id: number, now: number): ProposalDetail | null {
  const proposal = proposalById(c, id, now);
  if (!proposal) return null;
  return {
    proposal,
    bondedTokens: bondedTokensAt(c, now),
    quorum: QUORUM,
    threshold: THRESHOLD,
    vetoThreshold: VETO_THRESHOLD,
    voters: Math.round(proposal.turnout * 118_000 + 2_000),
  };
}

export function buildGovernanceStats(c: ChainConfig, now: number): GovernanceStats {
  const { items } = buildProposals(c, now);
  const decided = items.filter((p) => p.status !== 'voting' && p.status !== 'deposit');
  const outcomes = { passed: 0, rejected: 0, failed: 0 };
  for (const p of decided) if (p.status === 'passed' || p.status === 'rejected' || p.status === 'failed') outcomes[p.status] += 1;
  const sum = (key: keyof Tally): number => (decided.length ? decided.reduce((a, p) => a + p.tally[key], 0) / decided.length : 0);
  return {
    participation: [...items].reverse().map((p) => ({ id: p.id, turnout: p.turnout, status: p.status })),
    outcomes,
    avgTurnout: items.length ? items.reduce((a, p) => a + p.turnout, 0) / items.length : 0,
    quorum: QUORUM,
    threshold: THRESHOLD,
    vetoThreshold: VETO_THRESHOLD,
    voteShare: { yes: sum('yes'), no: sum('no'), abstain: sum('abstain'), veto: sum('veto') },
  };
}
