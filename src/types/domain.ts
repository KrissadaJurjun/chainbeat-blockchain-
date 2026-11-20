/** Shared domain model. Both the Demo provider and any future live provider produce these shapes. */

export type Range = '24H' | '7D' | '30D' | '90D';
export const RANGES: readonly Range[] = ['24H', '7D', '30D', '90D'];

export type AccentColor = 'purple' | 'cyan' | 'blue' | 'green' | 'yellow' | 'red' | 'amber';

/* ───────────────────────── chains & assets ───────────────────────── */

export interface ChainConfig {
  /** Stable URL/state id, e.g. `cosmoshub`. */
  id: string;
  /** Network identifier shown to users (simulated in Demo Mode). */
  chainId: string;
  name: string;
  shortName: string;
  symbol: string;
  denom: string;
  decimals: number;
  bech32Prefix: string;
  /** Icon gradient (CSS colours). */
  gradient: [string, string];
  /** Appears in the sidebar "Explorer" list and can be selected as the active network. */
  selectable: boolean;
  basePriceUsd: number;
  /** Annualised log-price volatility used by the simulator. */
  priceVol: number;
  /** Sensitivity to the shared market factor. */
  priceBeta: number;
  blockTimeSec: number;
  txPerBlock: number;
  /** Figures below are exactly true at SIM_TARGET_MS and evolve deterministically from there. */
  heightAtTarget: number;
  totalTxAtTarget: number;
  supplyAtTarget: number;
  bondedRatio: number;
  inflation: number;
  communityTax: number;
  communityPoolAtTarget: number;
  activeValidators: number;
  unbondingDays: number;
  votingPeriodDays: number;
  proposalsTotal: number;
  proposalsLive: number;
  ibcChannels: number;
  tvlUsd: number;
}

export type AssetKind = 'native' | 'ibc' | 'external' | 'stable' | 'liquid';

export interface AssetConfig {
  symbol: string;
  name: string;
  kind: AssetKind;
  basePriceUsd: number;
  vol: number;
  beta: number;
  circulating: number;
  decimals: number;
  color: AccentColor;
}

/* ───────────────────────── metrics ───────────────────────── */

export type MetricKey =
  | 'blockHeight'
  | 'totalTransactions'
  | 'txPerBlock'
  | 'blockTime'
  | 'inflation'
  | 'stakingApr'
  | 'bondedTokens'
  | 'totalSupply'
  | 'communityPool'
  | 'poolValue';

export interface ChainMetrics {
  chainId: string;
  symbol: string;
  asOf: number;
  blockHeight: number;
  totalTransactions: number;
  txPerBlock: number;
  blockTimeSec: number;
  inflation: number;
  stakingApr: number;
  bondedTokens: number;
  bondedRatio: number;
  totalSupply: number;
  communityPool: number;
  communityPoolShare: number;
  poolValueUsd: number;
  priceUsd: number;
  communityTax: number;
  /** Relative change versus 24 h earlier (fraction; e.g. 0.012 = +1.2 %). `blockHeight` carries the absolute delta. */
  trend24h: Partial<Record<MetricKey, number>>;
}

export interface HistoryPoint {
  t: number;
  v: number;
}

/* ───────────────────────── overview chart ───────────────────────── */

export interface OverviewSeriesMeta {
  id: string;
  symbol: string;
  name: string;
  color: AccentColor;
}

export interface OverviewPoint {
  t: number;
  /** Index values (Base = 100 at range start), aligned with `OverviewData.series`. */
  v: number[];
  /** USD prices, aligned with `OverviewData.series`. */
  p: number[];
}

export interface OverviewStat {
  id: string;
  /** Fractional change over the range. */
  change: number;
  high: number;
  low: number;
  lastIndex: number;
  lastPrice: number;
}

export interface OverviewData {
  range: Range;
  base: number;
  series: OverviewSeriesMeta[];
  points: OverviewPoint[];
  stats: OverviewStat[];
  asOf: number;
}

/* ───────────────────────── validators / governance ───────────────────────── */

export type ValidatorStatus = 'active' | 'jailed' | 'inactive';

export interface Validator {
  rank: number;
  moniker: string;
  operatorAddress: string;
  tokens: number;
  /** Share of total bonded tokens (0‥1). */
  votingPower: number;
  /** Cumulative share of everyone ranked at or above this validator. */
  cumulativePower: number;
  commission: number;
  uptime: number;
  status: ValidatorStatus;
  /** Token change over 24 h. */
  change24h: number;
  delegators: number;
}

export type ProposalStatus = 'voting' | 'deposit' | 'passed' | 'rejected' | 'failed';
export type ProposalType = 'text' | 'parameter' | 'spend' | 'upgrade' | 'ibc' | 'other';

export interface Tally {
  yes: number;
  no: number;
  abstain: number;
  veto: number;
}

export interface Proposal {
  id: number;
  title: string;
  /** One-line description shown in lists. */
  summary: string;
  /** Full description shown on the proposal page. */
  description: string;
  /** True for proposals the user drafted in Demo Mode (they exist only in this browser). */
  demo?: boolean;
  type: ProposalType;
  status: ProposalStatus;
  submitTime: number;
  votingEnd: number;
  deposit: number;
  minDeposit: number;
  /** Fractions that sum to 1. */
  tally: Tally;
  turnout: number;
  proposer: string;
}

export interface ProposalsData {
  live: number;
  total: number;
  items: Proposal[];
}

/** A proposal plus the network parameters needed to read its tally (quorum, thresholds, token counts). */
export interface ProposalDetail {
  proposal: Proposal;
  /** Bonded tokens at the time of the tally — turns fractions into token counts. */
  bondedTokens: number;
  quorum: number;
  threshold: number;
  vetoThreshold: number;
  /** Number of accounts that voted (simulated). */
  voters: number;
}

export interface GovernanceStats {
  participation: { id: number; turnout: number; status: ProposalStatus }[];
  outcomes: { passed: number; rejected: number; failed: number };
  avgTurnout: number;
  quorum: number;
  threshold: number;
  vetoThreshold: number;
  voteShare: Tally;
}

/* ───────────────────────── blocks & transactions ───────────────────────── */

export interface Block {
  height: number;
  hash: string;
  /** Hash of the previous block (all zeros for the first block). */
  parentHash: string;
  time: number;
  proposer: { moniker: string; address: string };
  txCount: number;
  gasUsed: number;
  gasLimit: number;
  sizeBytes: number;
}

export type TxType = 'send' | 'delegate' | 'undelegate' | 'claim' | 'vote' | 'ibc-transfer' | 'swap' | 'other';
export type TxStatus = 'success' | 'failed';

export interface Tx {
  hash: string;
  height: number;
  index: number;
  time: number;
  type: TxType;
  status: TxStatus;
  from: string;
  to?: string;
  amount: number;
  symbol: string;
  feeAmount: number;
  feeSymbol: string;
  memo: string;
  gasUsed: number;
  gasWanted: number;
  errorCode?: string;
}

/** One Cosmos-style event emitted by a transaction (rendered in the transaction page). */
export interface TxEvent {
  type: string;
  attributes: { key: string; value: string }[];
}

export type AccountKind = 'pool' | 'validator' | 'demo' | 'unknown';

export interface AccountBalance {
  symbol: string;
  amount: number;
  usd: number;
}

export interface AccountInfo {
  address: string;
  chainId: string;
  kind: AccountKind;
  /** Validator moniker, "Demo wallet", … — null for anonymous accounts. */
  label: string | null;
  balances: AccountBalance[];
  /** Native tokens delegated by this account. */
  staked: number;
  /** Unclaimed staking rewards (native tokens). */
  rewards: number;
  totalValueUsd: number;
  /** Number of transactions found in the scanned window. */
  txCount: number;
  /** How many of the newest blocks were scanned for this account's activity. */
  windowBlocks: number;
}

export interface AccountData {
  account: AccountInfo;
  /** Newest first. */
  txs: Tx[];
}

/** A validator plus the history and description shown on its own page. */
export interface ValidatorDetail {
  validator: Validator;
  description: string;
  /** Daily uptime (0‥1), oldest first. */
  uptimeHistory: HistoryPoint[];
  /** Daily share of bonded tokens (0‥1), oldest first. */
  powerHistory: HistoryPoint[];
  /** Blocks this validator proposed recently (newest first). */
  recentBlocks: Block[];
  /** Tokens the operator itself has bonded. */
  selfBonded: number;
  /** Simulated count of blocks proposed in the last 24 hours. */
  proposed24h: number;
}

export interface NetworkInfo {
  chainId: string;
  name: string;
  symbol: string;
  height: number;
  blockTimeSec: number;
  activeValidators: number;
  /** Where the data comes from: the Demo simulator or a configured live endpoint. */
  source: 'demo' | 'live';
  status: 'healthy' | 'degraded' | 'offline';
}

/* ───────────────────────── dev activity ───────────────────────── */

export interface DevDay {
  date: number;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface DevActivityData {
  /** weeks[w][d] — d = 0 is Sunday. The final week may be partial. */
  weeks: DevDay[][];
  total: number;
  activeDays: number;
  longestStreak: number;
}

export type RepoPeriod = 'week' | 'month' | 'quarter' | 'year';

export interface Repo {
  name: string;
  description: string;
  language: string;
  contributors: number;
  stars: number;
  /** Commits in the selected period. */
  commits: number;
  /** Fractional change in commits vs the previous period. */
  delta: number;
  series: number[];
}

/* ───────────────────────── market, tokens, network, ecosystem ───────────────────────── */

export interface MarketRow {
  symbol: string;
  name: string;
  kind: AssetKind;
  color: AccentColor;
  priceUsd: number;
  change24h: number;
  change7d: number;
  marketCapUsd: number;
  volume24hUsd: number;
  spark: number[];
}

export interface TokenRow {
  symbol: string;
  name: string;
  kind: AssetKind;
  color: AccentColor;
  denom: string;
  origin: string;
  priceUsd: number;
  change24h: number;
  supply: number;
  holders: number;
  marketCapUsd: number;
  decimals: number;
}

/** How concentrated the active validator set was on one day. Shares are fractions of the total voting power. */
export interface DominancePoint {
  t: number;
  top1: number;
  top5: number;
  top10: number;
  /** Fewest validators whose combined power exceeds one third (enough to halt the chain). */
  nakamoto: number;
}

export interface NetworkStats {
  blockTimes: { height: number; sec: number }[];
  txPerBlock: { height: number; tx: number }[];
  bondedHistory: { t: number; ratio: number; apr: number }[];
  /** Gas used against the block limit for the same last 60 blocks. */
  gasUsage: { height: number; used: number; limit: number }[];
  /** Transactions in those blocks, by outcome. */
  txOutcome: { ok: number; failed: number };
  params: { key: string; value: number; unit: 'percent' | 'days' | 'count' | 'seconds' | 'token' }[];
  uptime: number;
  activeValidators: number;
  peers: number;
}

export interface IbcNode {
  id: string;
  name: string;
  symbol: string;
  gradient: [string, string];
  /** Normalised layout position (0‥1). */
  x: number;
  y: number;
  channels: number;
  volume24hUsd: number;
}

export interface IbcLink {
  a: string;
  b: string;
  channel: string;
  volume24hUsd: number;
  transfers24h: number;
}

export interface IbcData {
  nodes: IbcNode[];
  links: IbcLink[];
  totalVolume24hUsd: number;
}

export interface MultichainRow {
  id: string;
  name: string;
  symbol: string;
  gradient: [string, string];
  height: number;
  blockTimeSec: number;
  validators: number;
  bondedRatio: number;
  stakingApr: number;
  priceUsd: number;
  change7d: number;
  tvlUsd: number;
  tx24h: number;
  spark: number[];
}

/* ───────────────────────── notifications & search ───────────────────────── */

export type NotificationKind = 'proposal' | 'validator' | 'network' | 'ibc' | 'block' | 'tx' | 'wallet' | 'warning';
export type NotificationTone = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  time: number;
  /** i18n key under `notifications.items.*` plus interpolation params. */
  messageKey: string;
  params: Record<string, string | number>;
  /** A second phrase translated at render time and placed into the message as `{{as}}` (so a language switch updates it). */
  nested?: { key: string; params: Record<string, string | number>; as: string };
  tone?: NotificationTone;
  href: string;
}

export type SearchResultKind = 'page' | 'validator' | 'block' | 'transaction' | 'token' | 'address' | 'proposal';

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  label: string;
  hint?: string;
  href: string;
}
