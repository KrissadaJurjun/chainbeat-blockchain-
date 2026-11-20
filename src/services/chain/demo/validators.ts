import { SIM_EPOCH_MS } from '@/lib/noise';
import { pick, rngFor, shuffle } from '@/lib/prng';
import { DAY_MS } from '@/lib/utils';
import type { ChainConfig, DominancePoint, Validator, ValidatorStatus } from '@/types/domain';
import { validatorAddress } from './ids';
import { bondedTokensAt } from './model';

/** Fictional validator brands — deliberately NOT real operators, since all figures are simulated. */
const PREFIXES = [
  'Aurora', 'Nimbus', 'Polar', 'Helio', 'Quasar', 'Orbit', 'Ember', 'Zenith', 'Lumen', 'Vertex', 'Cobalt', 'Atlas',
  'Borealis', 'Cascade', 'Drift', 'Echo', 'Fjord', 'Glacier', 'Harbor', 'Iris', 'Jade', 'Kestrel', 'Lattice', 'Meridian',
];
const SUFFIXES = ['Custody', 'Stake', 'Nodes', 'Labs', 'Validators', 'Systems', 'Staking', 'Network', 'Capital', 'Infra', 'Forge', 'Works'];
const COMMISSIONS = [0, 0.02, 0.05, 0.05, 0.05, 0.07, 0.08, 0.1, 0.1, 0.1, 0.15, 0.2];

export interface ValidatorBase {
  moniker: string;
  address: string;
  weight: number;
  commission: number;
  uptime: number;
  status: ValidatorStatus;
  phase: number;
  delegatorFactor: number;
}

const baseCache = new Map<string, ValidatorBase[]>();

/** Time-independent part of a chain's validator set (names, addresses, relative weights). Cached. */
export function validatorBase(c: ChainConfig): ValidatorBase[] {
  const cached = baseCache.get(c.id);
  if (cached) return cached;

  const rng = rngFor('validators', c.id);
  const names: string[] = [];
  for (const p of PREFIXES) for (const s of SUFFIXES) names.push(`${p} ${s}`);
  shuffle(rng, names);

  const total = c.activeValidators + 14;
  const out: ValidatorBase[] = [];
  for (let i = 0; i < total; i++) {
    const active = i < c.activeValidators;
    const status: ValidatorStatus = active ? 'active' : i % 3 === 0 ? 'jailed' : 'inactive';
    out.push({
      moniker: names[i] as string,
      address: validatorAddress(c.bech32Prefix, c.id, i),
      weight: active ? 1 / Math.pow(i + 3, 0.92) : 0.0002 * (0.3 + rng()),
      commission: pick(rng, COMMISSIONS),
      uptime: active ? 0.972 + rng() * 0.028 : 0.55 + rng() * 0.35,
      status,
      phase: rng() * Math.PI * 2,
      delegatorFactor: 0.7 + rng() * 0.6,
    });
  }
  baseCache.set(c.id, out);
  return out;
}

function shares(c: ChainConfig, t: number): number[] {
  const base = validatorBase(c);
  const w = base.map((b) => (b.status === 'active' ? b.weight * (1 + 0.035 * Math.sin(((t - SIM_EPOCH_MS) / (11 * DAY_MS)) * 2 * Math.PI + b.phase)) : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}

/** Concentration of voting power over the last `days` days (one point per day, oldest first). */
export function dominanceTrend(c: ChainConfig, now: number, days = 30): DominancePoint[] {
  const out: DominancePoint[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const t = now - d * DAY_MS;
    const sorted = shares(c, t).filter((s) => s > 0).sort((a, b) => b - a);
    const top = (n: number): number => sorted.slice(0, n).reduce((a, s) => a + s, 0);
    let running = 0;
    let nakamoto = 0;
    for (const s of sorted) {
      running += s;
      nakamoto++;
      if (running > 1 / 3) break;
    }
    out.push({ t, top1: top(1), top5: top(5), top10: top(10), nakamoto });
  }
  return out;
}

/** Share of the bonded stake one validator held at time `t` (0 for unknown or non-active validators). */
export function validatorShareAt(c: ChainConfig, address: string, t: number): number {
  const index = validatorBase(c).findIndex((b) => b.address === address);
  return index < 0 ? 0 : (shares(c, t)[index] as number);
}

/** The ranked validator set at time `t` (active validators first, by voting power). */
export function validatorsFor(c: ChainConfig, t: number): Validator[] {
  const base = validatorBase(c);
  const bonded = bondedTokensAt(c, t);
  const prevBonded = bondedTokensAt(c, t - DAY_MS);
  const now = shares(c, t);
  const prev = shares(c, t - DAY_MS);

  const rows = base.map((b, i) => {
    const share = now[i] as number;
    const tokens = b.status === 'active' ? bonded * share : bonded * b.weight * 0.4;
    const prevTokens = b.status === 'active' ? prevBonded * (prev[i] as number) : tokens;
    return { b, share, tokens, change: tokens - prevTokens };
  });

  rows.sort((a, b) => {
    if (a.b.status === 'active' && b.b.status !== 'active') return -1;
    if (a.b.status !== 'active' && b.b.status === 'active') return 1;
    return b.tokens - a.tokens;
  });

  let cumulative = 0;
  return rows.map((r, idx) => {
    if (r.b.status === 'active') cumulative += r.share;
    return {
      rank: idx + 1,
      moniker: r.b.moniker,
      operatorAddress: r.b.address,
      tokens: r.tokens,
      votingPower: r.b.status === 'active' ? r.share : 0,
      cumulativePower: r.b.status === 'active' ? cumulative : 1,
      commission: r.b.commission,
      uptime: r.b.uptime,
      status: r.b.status,
      change24h: r.change,
      delegators: Math.max(12, Math.round(r.share * 1_400_000 * r.b.delegatorFactor) + 40),
    };
  });
}
