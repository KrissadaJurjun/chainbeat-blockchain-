import { hexBytes, rngFor, unit } from '@/lib/prng';
import { DAY_MS, HOUR_MS } from '@/lib/utils';
import type {
  AccentColor,
  ChainConfig,
  DevActivityData,
  DevDay,
  IbcData,
  IbcLink,
  IbcNode,
  MultichainRow,
  Repo,
  RepoPeriod,
  TokenRow,
} from '@/types/domain';
import { heightAt } from './blocks';
import { stakingAprAt, bondedRatioAt } from './model';
import { priceAt } from './prices';
import { ASSETS, CHAINS } from '../registry';

const startOfDay = (t: number): number => Math.floor(t / DAY_MS) * DAY_MS;

/* ───────────────────────── developer activity ───────────────────────── */

export function buildDevActivity(c: ChainConfig, now: number): DevActivityData {
  const weeksCount = 53;
  const today = startOfDay(now);
  const todayDow = new Date(today).getUTCDay();
  const totalDays = (weeksCount - 1) * 7 + todayDow + 1;
  const first = today - (totalDays - 1) * DAY_MS;

  const counts: number[] = [];
  for (let i = 0; i < totalDays; i++) {
    const date = first + i * DAY_MS;
    const dow = new Date(date).getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 0.3 : 1;
    const season = 0.8 + 0.2 * Math.sin((date / DAY_MS) / 38 + (c.id.length % 5));
    const base = Math.pow(unit('dev', c.id, Math.round(date / DAY_MS)), 1.7);
    counts.push(Math.floor(base * 26 * weekend * season));
  }
  const max = Math.max(1, ...counts);
  const level = (n: number): DevDay['level'] => (n === 0 ? 0 : n / max <= 0.25 ? 1 : n / max <= 0.5 ? 2 : n / max <= 0.75 ? 3 : 4);

  const weeks: DevDay[][] = [];
  let activeDays = 0;
  let total = 0;
  let streak = 0;
  let longest = 0;
  counts.forEach((count, i) => {
    const date = first + i * DAY_MS;
    const dow = new Date(date).getUTCDay();
    if (dow === 0 || weeks.length === 0) weeks.push([]);
    (weeks[weeks.length - 1] as DevDay[]).push({ date, count, level: level(count) });
    total += count;
    if (count > 0) {
      activeDays += 1;
      streak += 1;
      longest = Math.max(longest, streak);
    } else streak = 0;
  });
  return { weeks, total, activeDays, longestStreak: longest };
}

/** Fictional repositories: the names are invented for Demo Mode and are not links to real projects. */
const REPOS: Array<{ name: string; description: string; language: string }> = [
  { name: 'chainbeat-explorer', description: 'Block and transaction explorer front-end', language: 'TypeScript' },
  { name: 'cosmos-data-adapter', description: 'Typed adapters for Cosmos REST and RPC data', language: 'TypeScript' },
  { name: 'wallet-integration', description: 'Wallet connection and signing helpers', language: 'TypeScript' },
  { name: 'ibc-relay-lab', description: 'IBC relayer experiments', language: 'Rust' },
  { name: 'governance-toolkit', description: 'Proposal tooling and tally analytics', language: 'Go' },
];
const PERIOD_POINTS: Record<RepoPeriod, number> = { week: 7, month: 10, quarter: 13, year: 12 };

/** Fictional repositories (names are generated, not real projects). */
export function buildRepos(c: ChainConfig, period: RepoPeriod): Repo[] {
  const points = PERIOD_POINTS[period];
  const scale = period === 'week' ? 9 : period === 'month' ? 38 : period === 'quarter' ? 85 : 160;
  return REPOS.map(({ name: label, description, language }, idx) => {
    const name = c.id + '/' + label; // seed: the same project looks different on each network
    const trend = (unit('repo-trend', name, period) - 0.4) * 1.1;
    const series = Array.from({ length: points }, (_, i) => {
      const wave = 0.6 + 0.4 * Math.sin(i * 0.9 + idx * 1.7) ;
      const drift = 1 + trend * (i / (points - 1) - 0.5);
      return Math.max(1, Math.round(scale * wave * drift * (0.65 + unit('repo', name, period, i) * 0.7)));
    });
    const commits = series.reduce((a, b) => a + b, 0);
    const prev = Math.max(1, Math.round(commits / (1 + trend * 0.5 + (unit('repo-prev', name, period) - 0.5) * 0.3)));
    return {
      name: label,
      description,
      language,
      contributors: 8 + Math.round(unit('repo-c', name) * 160),
      stars: 40 + Math.round(unit('repo-s', name) * 1800),
      commits,
      delta: commits / prev - 1,
      series,
    };
  });
}

/* ───────────────────────── IBC ───────────────────────── */

export function buildIbc(now: number): IbcData {
  const n = CHAINS.length;
  const nodes: IbcNode[] = CHAINS.map((c, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { id: c.id, name: c.name, symbol: c.symbol, gradient: c.gradient, x: 0.5 + 0.38 * Math.cos(angle), y: 0.5 + 0.36 * Math.sin(angle), channels: c.ibcChannels, volume24hUsd: 0 };
  });
  const links: IbcLink[] = [];
  const add = (a: ChainConfig, b: ChainConfig, weight: number): void => {
    const key = [a.id, b.id].sort().join('-');
    const wobble = 1 + 0.18 * Math.sin(now / (2 * HOUR_MS) + unit('ibc-phase', key) * 6.28);
    const volume = weight * (0.35 + unit('ibc-vol', key)) * wobble * 1_000_000;
    links.push({ a: a.id, b: b.id, channel: `channel-${Math.floor(unit('ibc-ch', key) * 900)}`, volume24hUsd: volume, transfers24h: Math.round(volume / (180 + unit('ibc-avg', key) * 900)) });
  };
  const hub = CHAINS[0] as ChainConfig;
  const osmo = CHAINS[1] as ChainConfig;
  add(hub, osmo, 38);
  for (const c of CHAINS.slice(2)) {
    add(hub, c, 6);
    add(osmo, c, 9);
  }
  const rest = CHAINS.slice(2);
  for (let i = 0; i < rest.length; i++)
    for (let j = i + 1; j < rest.length; j++) if (unit('ibc-extra', rest[i]!.id, rest[j]!.id) < 0.28) add(rest[i]!, rest[j]!, 1.4);

  for (const node of nodes) node.volume24hUsd = links.filter((l) => l.a === node.id || l.b === node.id).reduce((a, l) => a + l.volume24hUsd, 0);
  return { nodes, links, totalVolume24hUsd: links.reduce((a, l) => a + l.volume24hUsd, 0) };
}

/* ───────────────────────── Multichain ───────────────────────── */

export function buildMultichain(now: number): MultichainRow[] {
  return CHAINS.map((c) => {
    const spark: number[] = [];
    for (let i = 27; i >= 0; i--) spark.push(priceAt(c.symbol, now - i * 6 * HOUR_MS));
    const price = priceAt(c.symbol, now);
    return {
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      gradient: c.gradient,
      height: heightAt(c, now),
      blockTimeSec: c.blockTimeSec,
      validators: c.activeValidators,
      bondedRatio: bondedRatioAt(c, now),
      stakingApr: stakingAprAt(c, now),
      priceUsd: price,
      change7d: price / priceAt(c.symbol, now - 7 * DAY_MS) - 1,
      tvlUsd: c.tvlUsd * (price / c.basePriceUsd) ** 0.6,
      tx24h: Math.round((DAY_MS / (c.blockTimeSec * 1000)) * c.txPerBlock),
      spark,
    };
  });
}

/* ───────────────────────── Tokens ───────────────────────── */

export function buildTokens(c: ChainConfig, now: number): TokenRow[] {
  return ASSETS.map((a) => {
    const price = priceAt(a.symbol, now);
    const home = a.symbol === c.symbol;
    const origin = a.kind === 'native' ? (CHAINS.find((x) => x.symbol === a.symbol)?.name ?? a.name) : a.kind === 'stable' ? 'Noble (simulated)' : a.kind === 'liquid' ? 'Liquid staking (simulated)' : 'External (simulated)';
    return {
      symbol: a.symbol,
      name: a.name,
      kind: home ? 'native' : a.kind === 'native' ? 'ibc' : a.kind,
      color: a.color as AccentColor,
      denom: home ? c.denom : `ibc/${hexBytes(rngFor('denom', c.id, a.symbol), 32)}`,
      origin,
      priceUsd: price,
      change24h: price / priceAt(a.symbol, now - DAY_MS) - 1,
      supply: a.circulating,
      holders: Math.round(Math.pow(a.circulating, 0.42) * (0.6 + unit('holders', a.symbol) * 0.8)),
      marketCapUsd: price * a.circulating,
      decimals: a.decimals,
    };
  });
}
