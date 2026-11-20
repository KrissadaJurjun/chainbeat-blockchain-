import { describe, expect, it } from 'vitest';
import { checkAddress } from '@/lib/bech32';
import { RANGES } from '@/types/domain';
import { CHAINS, SELECTABLE_CHAINS, getChain } from '../registry';
import { blockAt, blockTime, findBlockByHash, findTx, heightAt, latestBlocks, latestTxs, txCountAt, txsForBlock } from './blocks';
import { buildGovernanceStats, buildProposals } from './governance';
import { decodeRef, encodeRef } from './ids';
import { buildMetrics, metricHistory } from './metrics';
import { buildOverview, buildPriceHistory, buildVolumeHistory, overviewPointCount, priceAt } from './prices';
import { validatorsFor } from './validators';

/** An hour-aligned instant, so every range ends on the same timestamp. */
const NOW = Date.UTC(2026, 10, 18, 9, 0, 0);
const hub = getChain('cosmoshub');
const osmo = getChain('osmosis');

describe('Overview series', () => {
  it.each(RANGES)('%s returns the documented number of points, all rebased to 100', (range) => {
    const data = buildOverview(range, NOW);
    expect(data.points).toHaveLength(overviewPointCount(range));
    expect(data.points[0]?.v.every((v) => Math.abs(v - 100) < 1e-9)).toBe(true);
    expect(data.series.map((s) => s.symbol)).toEqual(['ATOM', 'OSMO', 'BTC']);
  });

  it('point counts per range are 97 / 169 / 121 / 91', () => {
    expect(RANGES.map(overviewPointCount)).toEqual([97, 169, 121, 91]);
  });

  it('is deterministic: the same moment always yields identical data', () => {
    expect(JSON.stringify(buildOverview('7D', NOW))).toBe(JSON.stringify(buildOverview('7D', NOW)));
    // and stable within a bucket: 4 minutes later is the same 15-minute bucket for 24H
    expect(buildOverview('24H', NOW + 4 * 60_000).points.at(-1)?.t).toBe(buildOverview('24H', NOW).points.at(-1)?.t);
  });

  it('ranges agree with each other (a price at a timestamp is the same in every range)', () => {
    const day = buildOverview('24H', NOW);
    const week = buildOverview('7D', NOW);
    const last24 = day.points.at(-1);
    const last7 = week.points.at(-1);
    expect(last24?.t).toBe(last7?.t);
    expect(last24?.p).toEqual(last7?.p);
    // every point's price equals the pure price function at that time
    for (const pt of week.points.filter((_, i) => i % 40 === 0)) {
      expect(pt.p[0]).toBeCloseTo(priceAt('ATOM', pt.t), 10);
    }
  });

  it('index values equal price ratios and stats are derived from them', () => {
    const d = buildOverview('30D', NOW);
    const first = d.points[0]!;
    const last = d.points.at(-1)!;
    expect(last.v[1]).toBeCloseTo((100 * (last.p[1] as number)) / (first.p[1] as number), 9);
    expect(d.stats[1]?.change).toBeCloseTo((last.v[1] as number) / 100 - 1, 9);
    expect(d.stats[1]?.high).toBeGreaterThanOrEqual(d.stats[1]?.low as number);
  });

  it('prices hit their configured base exactly at the target instant and look plausible nearby', () => {
    expect(priceAt('ATOM', Date.UTC(2026, 10, 18))).toBeCloseTo(hub.basePriceUsd, 6);
    for (const range of RANGES) for (const p of buildPriceHistory('BTC', range, NOW)) expect(p.v).toBeGreaterThan(20_000);
  });

  it('stablecoins stay pegged and liquid-staking tokens trade at a premium to their base asset', () => {
    expect(Math.abs(priceAt('USDC', NOW) - 1)).toBeLessThan(0.01);
    expect(priceAt('stATOM', NOW)).toBeGreaterThan(priceAt('ATOM', NOW));
  });
});

describe.each(SELECTABLE_CHAINS)('Metrics for $name are one coherent model', (chain) => {
  const m = buildMetrics(chain, NOW);

  it('bonded = supply × bonded ratio; APR follows from inflation, tax and ratio', () => {
    expect(m.bondedTokens).toBeCloseTo(m.totalSupply * m.bondedRatio, 3);
    expect(m.stakingApr).toBeCloseTo((m.inflation * (1 - chain.communityTax)) / m.bondedRatio, 10);
  });

  it('pool value = pool × price and pool share = pool ÷ supply', () => {
    expect(m.poolValueUsd).toBeCloseTo(m.communityPool * m.priceUsd, 3);
    expect(m.communityPoolShare).toBeCloseTo(m.communityPool / m.totalSupply, 12);
  });

  it('block time and tx/block are measured from the very blocks the explorer lists', () => {
    const tip = heightAt(chain, NOW);
    const txs = Array.from({ length: 100 }, (_, k) => txCountAt(chain, tip - k));
    expect(m.txPerBlock).toBeCloseTo(txs.reduce((a, b) => a + b, 0) / 100, 10);
    expect(m.blockTimeSec).toBeCloseTo((blockTime(chain, tip) - blockTime(chain, tip - 100)) / 100 / 1000, 10);
    expect(Math.abs(m.blockTimeSec - chain.blockTimeSec)).toBeLessThan(chain.blockTimeSec * 0.05);
  });

  it('exposes a 24h trend for all ten metrics and the height trend ≈ blocks per day', () => {
    expect(Object.keys(m.trend24h)).toHaveLength(10);
    expect(Math.abs((m.trend24h.blockHeight as number) - 86_400 / chain.blockTimeSec)).toBeLessThanOrEqual(2);
  });

  it('metric history is hourly, oldest first, and ends at the current value', () => {
    const h = metricHistory(chain, 'totalSupply', NOW, 24);
    expect(h).toHaveLength(24);
    expect(h.every((p, i) => i === 0 || p.t > (h[i - 1] as { t: number }).t)).toBe(true);
    expect(h.at(-1)?.v).toBeCloseTo(m.totalSupply, 3);
  });
});

describe('headline figures match the documented example at the target instant', () => {
  it('Cosmos Hub: supply 434.64M, bonded ≈ 216.7M (49.9 %), inflation ≈ 10 %', () => {
    const m = buildMetrics(hub, Date.UTC(2026, 10, 18));
    expect(m.totalSupply).toBeCloseTo(434_640_000, -2);
    expect(m.bondedTokens / 1e6).toBeCloseTo(216.7, 0);
    expect(m.inflation).toBeCloseTo(0.1, 2);
  });
});

describe('Blocks and transactions', () => {
  it('timestamps strictly increase with height', () => {
    const tip = heightAt(hub, NOW);
    for (let h = tip - 1500; h < tip; h++) expect(blockTime(hub, h + 1)).toBeGreaterThan(blockTime(hub, h));
  });

  it('latestBlocks is newest-first, consistent with its transactions, and within gas limits', () => {
    const blocks = latestBlocks(hub, NOW, 40);
    expect(blocks).toHaveLength(40);
    expect(blocks.every((b, i) => i === 0 || b.height === (blocks[i - 1] as { height: number }).height - 1)).toBe(true);
    for (const b of blocks.slice(0, 8)) {
      expect(txsForBlock(hub, b.height)).toHaveLength(b.txCount);
      expect(b.gasUsed).toBeLessThanOrEqual(b.gasLimit);
      expect(b.proposer.moniker.length).toBeGreaterThan(2);
    }
  });

  it('hashes encode (kind, height, index) invertibly and reject forgeries / other chains', () => {
    const hash = encodeRef(hub.id, 'tx', 24_254_001, 7);
    expect(hash).toMatch(/^[0-9A-F]{64}$/);
    expect(decodeRef(hub.id, hash)).toEqual({ kind: 'tx', height: 24_254_001, index: 7 });
    expect(decodeRef(hub.id, hash.toLowerCase())).toEqual({ kind: 'tx', height: 24_254_001, index: 7 });
    const forged = `${hash.slice(0, 63)}${hash.endsWith('0') ? '1' : '0'}`;
    expect(decodeRef(hub.id, forged)).toBeNull();
    expect(decodeRef(osmo.id, hash)).toBeNull();
    expect(decodeRef(hub.id, 'not-a-hash')).toBeNull();
  });

  it('every listed transaction can be found again by its hash; blocks too', () => {
    const txs = latestTxs(hub, NOW, 30);
    expect(txs).toHaveLength(30);
    for (const tx of txs.slice(0, 10)) expect(findTx(hub, NOW, tx.hash)).toEqual(tx);
    const block = blockAt(hub, heightAt(hub, NOW) - 3);
    expect(findBlockByHash(hub, NOW, block.hash)?.height).toBe(block.height);
    expect(findTx(hub, NOW, 'A'.repeat(64))).toBeNull();
  });

  it('transaction addresses are real bech32 with the chain prefix', () => {
    for (const tx of latestTxs(osmo, NOW, 20)) {
      expect(checkAddress(tx.from, osmo.bech32Prefix).ok).toBe(true);
      // staking messages name a validator operator address; transfers name an account address
      if (tx.to) expect(checkAddress(tx.to, osmo.bech32Prefix + (['delegate', 'undelegate', 'claim'].includes(tx.type) ? 'valoper' : '')).ok).toBe(true);
      expect(tx.gasUsed).toBeLessThanOrEqual(tx.gasWanted);
    }
  });
});

describe.each(CHAINS)('Validator set for $name', (chain) => {
  const vs = validatorsFor(chain, NOW);
  const active = vs.filter((v) => v.status === 'active');

  it('has the configured number of active validators, ranked by power, summing to 100 %', () => {
    expect(active).toHaveLength(chain.activeValidators);
    expect(active.reduce((a, v) => a + v.votingPower, 0)).toBeCloseTo(1, 9);
    expect(active.every((v, i) => i === 0 || v.votingPower <= (active[i - 1] as { votingPower: number }).votingPower + 1e-12)).toBe(true);
    expect(active.at(-1)?.cumulativePower).toBeCloseTo(1, 9);
    expect(vs.map((v) => v.rank)).toEqual(vs.map((_, i) => i + 1));
  });

  it('uses unique names and valid validator-operator addresses', () => {
    expect(new Set(vs.map((v) => v.moniker)).size).toBe(vs.length);
    for (const v of vs.slice(0, 15)) expect(checkAddress(v.operatorAddress, `${chain.bech32Prefix}valoper`).ok).toBe(true);
  });
});

describe('Governance', () => {
  it('Cosmos Hub has live proposals, Osmosis has none (so the empty state is reachable)', () => {
    expect(buildProposals(hub, NOW).items.filter((p) => p.status === 'voting')).toHaveLength(hub.proposalsLive);
    expect(buildProposals(osmo, NOW).items.some((p) => p.status === 'voting')).toBe(false);
  });

  it('tallies sum to 1, ids descend, and decided proposals are consistent with their outcome', () => {
    const { items } = buildProposals(hub, NOW);
    expect(items[0]?.id).toBe(hub.proposalsTotal);
    for (const p of items) {
      expect(p.tally.yes + p.tally.no + p.tally.abstain + p.tally.veto).toBeCloseTo(1, 9);
      expect(p.votingEnd).toBeGreaterThan(p.submitTime);
      if (p.status === 'passed') expect(p.tally.yes).toBeGreaterThan(0.5);
      if (p.status === 'failed') expect(p.turnout).toBeLessThan(0.334);
    }
  });

  it('governance stats outcomes add up to the decided proposals', () => {
    const stats = buildGovernanceStats(hub, NOW);
    const decided = buildProposals(hub, NOW).items.filter((p) => ['passed', 'rejected', 'failed'].includes(p.status)).length;
    expect(stats.outcomes.passed + stats.outcomes.rejected + stats.outcomes.failed).toBe(decided);
    expect(stats.voteShare.yes + stats.voteShare.no + stats.voteShare.abstain + stats.voteShare.veto).toBeCloseTo(1, 9);
  });
});

describe('simulated volume history', () => {
  it('has one positive, deterministic bucket per price point and scales with the asset size', () => {
    for (const range of RANGES) {
      const prices = buildPriceHistory('ATOM', range, NOW);
      const volume = buildVolumeHistory('ATOM', range, NOW);
      expect(volume.map((p) => p.t)).toEqual(prices.map((p) => p.t));
      expect(volume.every((p) => p.v > 0 && Number.isFinite(p.v))).toBe(true);
      expect(buildVolumeHistory('ATOM', range, NOW)).toEqual(volume);
    }
    const sum = (symbol: string) => buildVolumeHistory(symbol, '7D', NOW).reduce((a, p) => a + p.v, 0);
    expect(sum('BTC')).toBeGreaterThan(sum('TIA')); // a far larger market trades far more
  });
});
