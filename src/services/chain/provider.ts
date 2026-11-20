import type {
  AccountData,
  AppNotification,
  Block,
  ChainMetrics,
  DevActivityData,
  DominancePoint,
  GovernanceStats,
  HistoryPoint,
  IbcData,
  MarketRow,
  MetricKey,
  MultichainRow,
  NetworkInfo,
  NetworkStats,
  OverviewData,
  ProposalDetail,
  ProposalsData,
  Range,
  Repo,
  RepoPeriod,
  SearchResult,
  TokenRow,
  Tx,
  Validator,
  ValidatorDetail,
} from '@/types/domain';

export interface RequestOptions {
  signal?: AbortSignal;
}

/**
 * The seam between the UI and a blockchain data source.
 *
 * UI components never talk to an RPC node or a blockchain SDK directly — they call hooks that call a
 * `ChainDataProvider`. Today the only implementation is the Demo provider (deterministic simulated
 * data). A live provider (Cosmos REST/RPC, or an EVM adapter) implements this same interface and is
 * registered in `services/chain/index.ts`; no component has to change.
 */
export interface ChainDataProvider {
  readonly id: string;
  readonly label: string;
  /** True when data is generated locally rather than read from a network. Drives the "Demo" badges. */
  readonly simulated: boolean;

  getNetworkInfo(chainId: string, o?: RequestOptions): Promise<NetworkInfo>;
  getMetrics(chainId: string, o?: RequestOptions): Promise<ChainMetrics>;
  getMetricHistory(chainId: string, key: MetricKey, o?: RequestOptions): Promise<HistoryPoint[]>;
  getOverview(chainId: string, range: Range, o?: RequestOptions): Promise<OverviewData>;
  getValidators(chainId: string, o?: RequestOptions): Promise<Validator[]>;
  /** Null when the validator does not exist on this chain. */
  getValidatorDetails(chainId: string, address: string, o?: RequestOptions): Promise<ValidatorDetail | null>;
  getProposals(chainId: string, o?: RequestOptions): Promise<ProposalsData>;
  /** Null when the proposal does not exist on this chain. */
  getProposalDetails(chainId: string, id: number, o?: RequestOptions): Promise<ProposalDetail | null>;
  /** Null when `address` is not a valid address for this chain. `around` widens the history to ±1 500 blocks around a height. */
  getAccount(chainId: string, address: string, o?: RequestOptions & { around?: number; limit?: number }): Promise<AccountData | null>;
  getGovernanceStats(chainId: string, o?: RequestOptions): Promise<GovernanceStats>;
  getBlocks(chainId: string, limit: number, o?: RequestOptions): Promise<Block[]>;
  getBlock(chainId: string, height: number, o?: RequestOptions): Promise<{ block: Block; txs: Tx[] } | null>;
  /** Newest-first transactions. `before` (epoch ms) lists the latest ones up to that instant instead of up to now. */
  getTransactions(chainId: string, limit: number, o?: RequestOptions & { before?: number }): Promise<Tx[]>;
  getTransaction(chainId: string, hash: string, o?: RequestOptions): Promise<Tx | null>;
  getDevActivity(chainId: string, o?: RequestOptions): Promise<DevActivityData>;
  getRepositories(chainId: string, period: RepoPeriod, o?: RequestOptions): Promise<Repo[]>;
  getMarket(o?: RequestOptions): Promise<MarketRow[]>;
  getPriceHistory(symbol: string, range: Range, o?: RequestOptions): Promise<HistoryPoint[]>;
  getVolumeHistory(symbol: string, range: Range, o?: RequestOptions): Promise<HistoryPoint[]>;
  getNetworkStats(chainId: string, o?: RequestOptions): Promise<NetworkStats>;
  getDominanceTrend(chainId: string, o?: RequestOptions): Promise<DominancePoint[]>;
  getIbc(o?: RequestOptions): Promise<IbcData>;
  getMultichain(o?: RequestOptions): Promise<MultichainRow[]>;
  getTokens(chainId: string, o?: RequestOptions): Promise<TokenRow[]>;
  getNotifications(chainId: string, o?: RequestOptions): Promise<AppNotification[]>;
  search(chainId: string, query: string, o?: RequestOptions): Promise<SearchResult[]>;
}

export class SimulatedNetworkError extends Error {
  constructor(message = 'Simulated network failure (Demo Mode)') {
    super(message);
    this.name = 'SimulatedNetworkError';
  }
}
