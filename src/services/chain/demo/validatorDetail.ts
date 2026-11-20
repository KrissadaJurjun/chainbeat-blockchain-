import { pick, rngFor, unit } from '@/lib/prng';
import { DAY_MS } from '@/lib/utils';
import type { Block, ChainConfig, HistoryPoint, ValidatorDetail } from '@/types/domain';
import { blockAt, blockMs, heightAt, proposerAt } from './blocks';
import { validatorsFor, validatorShareAt } from './validators';

const BLURBS = [
  'Independent staking operator running redundant nodes across three regions.',
  'Community-run validator focused on uptime, transparent commission and public dashboards.',
  'Infrastructure team operating bare-metal servers with automated failover.',
  'Staking service that publishes its slashing-protection and key-management practices.',
  'Research-driven operator contributing tooling and monitoring to the ecosystem.',
  'Professional node operator with 24/7 on-call engineers.',
];
const DISCLAIMER = 'This is a fictional validator generated for Demo Mode. It is not a real operator and none of this is verified.';

const SCAN_BLOCKS = 3000;
const RECENT = 10;

/** Everything the validator page shows. Null when the address is not in this chain's simulated set. */
export function validatorDetail(c: ChainConfig, address: string, now: number): ValidatorDetail | null {
  const validator = validatorsFor(c, now).find((v) => v.operatorAddress === address);
  if (!validator) return null;

  const rng = rngFor('valdesc', c.id, address);
  const uptimeHistory: HistoryPoint[] = [];
  for (let d = 89; d >= 0; d--) {
    const t = now - d * DAY_MS;
    const dip = unit('upt', c.id, address, Math.floor(t / DAY_MS));
    const base = validator.status === 'active' ? validator.uptime : validator.uptime * 0.9;
    uptimeHistory.push({ t, v: Math.max(0.4, Math.min(1, 1 - (1 - base) * (0.3 + dip * 1.4))) });
  }
  const powerHistory: HistoryPoint[] = [];
  for (let d = 29; d >= 0; d--) {
    const t = now - d * DAY_MS;
    powerHistory.push({ t, v: validatorShareAt(c, address, t) });
  }

  const tip = heightAt(c, now);
  const recentBlocks: Block[] = [];
  for (let h = tip; h > tip - SCAN_BLOCKS && h > 0 && recentBlocks.length < RECENT; h--) {
    if (proposerAt(c, h).address === address) recentBlocks.push(blockAt(c, h));
  }

  return {
    validator,
    description: `${pick(rng, BLURBS)} ${DISCLAIMER}`,
    uptimeHistory,
    powerHistory,
    recentBlocks,
    selfBonded: Math.round(validator.tokens * (0.02 + rng() * 0.06)),
    proposed24h: Math.round((DAY_MS / blockMs(c)) * validator.votingPower),
  };
}
