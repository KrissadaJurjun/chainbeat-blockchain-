import { paths } from '@/lib/paths';
import { sleep } from '@/lib/utils';
import { getSimNow, useSimStore } from '@/stores/simStore';
import { SimulatedNetworkError, type ChainDataProvider, type RequestOptions } from './provider';
import { accountData } from './demo/accounts';
import { findBlockByHash, findTx, latestBlocks, latestTxs, blockAt, heightAt, txsForBlock } from './demo/blocks';
import { buildDevActivity, buildIbc, buildMultichain, buildRepos, buildTokens } from './demo/ecosystem';
import { buildNotifications, searchEntities } from './demo/feed';
import { buildGovernanceStats, buildProposals, proposalDetail } from './demo/governance';
import { buildMetrics, buildNetworkStats, metricHistory } from './demo/metrics';
import { buildMarket, buildOverview, buildPriceHistory, buildVolumeHistory } from './demo/prices';
import { dominanceTrend, validatorsFor } from './demo/validators';
import { validatorDetail } from './demo/validatorDetail';
import { getChain } from './registry';

/**
 * Wraps a pure, synchronous computation in the behaviour of a network call: artificial latency
 * (cancellable) and optional forced failure. The computation itself reads the simulated clock at the
 * moment it runs, so refetching naturally yields newer blocks.
 */
async function simulate<T>(compute: () => T, o?: RequestOptions): Promise<T> {
  const { latencyMs, forceError } = useSimStore.getState();
  await sleep(Math.round(latencyMs * (0.75 + Math.random() * 0.5)), o?.signal);
  if (forceError) throw new SimulatedNetworkError();
  return compute();
}

export const demoProvider: ChainDataProvider = {
  id: 'demo',
  label: 'Demo (simulated)',
  simulated: true,

  getNetworkInfo: (chainId, o) =>
    simulate(() => {
      const chain = getChain(chainId);
      return {
        chainId: chain.chainId,
        name: chain.name,
        symbol: chain.symbol,
        height: heightAt(chain, getSimNow()),
        blockTimeSec: chain.blockTimeSec,
        activeValidators: chain.activeValidators,
        source: 'demo' as const,
        status: 'healthy' as const,
      };
    }, o),
  getMetrics: (chainId, o) => simulate(() => buildMetrics(getChain(chainId), getSimNow()), o),
  getMetricHistory: (chainId, key, o) => simulate(() => metricHistory(getChain(chainId), key, getSimNow()), o),
  getOverview: (_chainId, range, o) => simulate(() => buildOverview(range, getSimNow()), o),
  getValidators: (chainId, o) => simulate(() => validatorsFor(getChain(chainId), getSimNow()), o),
  getValidatorDetails: (chainId, address, o) => simulate(() => validatorDetail(getChain(chainId), address, getSimNow()), o),
  getProposals: (chainId, o) => simulate(() => buildProposals(getChain(chainId), getSimNow()), o),
  getProposalDetails: (chainId, id, o) => simulate(() => proposalDetail(getChain(chainId), id, getSimNow()), o),
  getAccount: (chainId, address, o) => simulate(() => accountData(getChain(chainId), address, getSimNow(), { around: o?.around, limit: o?.limit }), o),
  getGovernanceStats: (chainId, o) => simulate(() => buildGovernanceStats(getChain(chainId), getSimNow()), o),
  getBlocks: (chainId, limit, o) => simulate(() => latestBlocks(getChain(chainId), getSimNow(), limit), o),
  getBlock: (chainId, height, o) =>
    simulate(() => {
      const chain = getChain(chainId);
      if (!Number.isInteger(height) || height < 1 || height > heightAt(chain, getSimNow())) return null;
      return { block: blockAt(chain, height), txs: txsForBlock(chain, height) };
    }, o),
  getTransactions: (chainId, limit, o) =>
    simulate(() => {
      const now = getSimNow();
      return latestTxs(getChain(chainId), Math.min(now, o?.before ?? now), limit);
    }, o),
  getTransaction: (chainId, hash, o) => simulate(() => findTx(getChain(chainId), getSimNow(), hash), o),
  getDevActivity: (chainId, o) => simulate(() => buildDevActivity(getChain(chainId), getSimNow()), o),
  getRepositories: (chainId, period, o) => simulate(() => buildRepos(getChain(chainId), period), o),
  getMarket: (o) => simulate(() => buildMarket(getSimNow()), o),
  getPriceHistory: (symbol, range, o) => simulate(() => buildPriceHistory(symbol, range, getSimNow()), o),
  getVolumeHistory: (symbol, range, o) => simulate(() => buildVolumeHistory(symbol, range, getSimNow()), o),
  getDominanceTrend: (chainId, o) => simulate(() => dominanceTrend(getChain(chainId), getSimNow()), o),
  getNetworkStats: (chainId, o) => simulate(() => buildNetworkStats(getChain(chainId), getSimNow()), o),
  getIbc: (o) => simulate(() => buildIbc(getSimNow()), o),
  getMultichain: (o) => simulate(() => buildMultichain(getSimNow()), o),
  getTokens: (chainId, o) => simulate(() => buildTokens(getChain(chainId), getSimNow()), o),
  getNotifications: (chainId, o) => simulate(() => buildNotifications(getChain(chainId), getSimNow()), o),
  search: (chainId, query, o) =>
    simulate(() => {
      const chain = getChain(chainId);
      const now = getSimNow();
      const results = searchEntities(chain, now, query);
      // a pasted block hash resolves directly
      if (results.length === 0 && /^[0-9a-fA-F]{64}$/.test(query.trim())) {
        const block = findBlockByHash(chain, now, query.trim());
        if (block) return [{ kind: 'block' as const, id: `block:${block.height}`, label: `#${block.height}`, href: paths.block(block.height) }];
      }
      return results;
    }, o),
};
