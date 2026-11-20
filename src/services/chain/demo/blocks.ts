import { SIM_TARGET_MS, slowNoiseFromTarget } from '@/lib/noise';
import { pickWeighted, rngFor, unit } from '@/lib/prng';
import type { Block, ChainConfig, Tx, TxType } from '@/types/domain';
import { decodeRef, encodeRef } from './ids';
import { participantsAt, poolAddress } from './pool';
import { priceAt } from './prices';
import { validatorBase } from './validators';

export const GAS_LIMIT = 50_000_000;

export const blockMs = (c: ChainConfig): number => c.blockTimeSec * 1000;

/** Height of the most recent block at simulated time `t`. */
export const heightAt = (c: ChainConfig, t: number): number => c.heightAtTarget + Math.floor((t - SIM_TARGET_MS) / blockMs(c));

/** Block timestamps follow the nominal cadence plus bounded jitter, so they stay strictly increasing. */
export function blockTime(c: ChainConfig, height: number): number {
  const nominal = SIM_TARGET_MS + (height - c.heightAtTarget) * blockMs(c);
  return Math.round(nominal + (unit('bt', c.id, height) - 0.5) * 0.7 * blockMs(c));
}

/** Slowly varying mean transactions per block. */
export const meanTxAt = (c: ChainConfig, t: number): number => c.txPerBlock * (1 + 0.12 * slowNoiseFromTarget(`txmean:${c.id}`)(t));

export function txCountAt(c: ChainConfig, height: number): number {
  const mean = meanTxAt(c, blockTime(c, height));
  const spread = mean * 0.7;
  return Math.max(0, Math.round(mean + (unit('txc', c.id, height) - 0.5) * 2 * spread));
}

function txGas(c: ChainConfig, height: number, index: number): { wanted: number; used: number } {
  const wanted = Math.round(90_000 + unit('gw', c.id, height, index) * 310_000);
  return { wanted, used: Math.round(wanted * (0.62 + unit('gu', c.id, height, index) * 0.33)) };
}

/* validator selection weighted by voting power (block proposers, staking-transaction targets) */
const proposerCache = new Map<string, { cumulative: number[]; total: number }>();
function validatorByUnit(c: ChainConfig, u: number): { moniker: string; address: string } {
  let table = proposerCache.get(c.id);
  const base = validatorBase(c);
  if (!table) {
    const cumulative: number[] = [];
    let total = 0;
    for (const v of base) {
      total += v.status === 'active' ? v.weight : 0;
      cumulative.push(total);
    }
    table = { cumulative, total };
    proposerCache.set(c.id, table);
  }
  const r = u * table.total;
  let lo = 0;
  let hi = table.cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((table.cumulative[mid] as number) < r) lo = mid + 1;
    else hi = mid;
  }
  const v = base[lo] ?? base[0];
  return { moniker: v!.moniker, address: v!.address };
}

export const proposerAt = (c: ChainConfig, height: number): { moniker: string; address: string } => validatorByUnit(c, unit('prop', c.id, height));

export function blockAt(c: ChainConfig, height: number): Block {
  const txCount = txCountAt(c, height);
  let gasUsed = 0;
  for (let i = 0; i < txCount; i++) gasUsed += txGas(c, height, i).used;
  return {
    height,
    hash: encodeRef(c.id, 'block', height),
    parentHash: height > 1 ? encodeRef(c.id, 'block', height - 1) : '0'.repeat(64),
    time: blockTime(c, height),
    proposer: proposerAt(c, height),
    txCount,
    gasUsed,
    gasLimit: GAS_LIMIT,
    sizeBytes: Math.round(1_200 + txCount * (420 + unit('sz', c.id, height) * 280)),
  };
}

/** Newest-first list of blocks ending at the chain tip for time `t`. */
export function latestBlocks(c: ChainConfig, t: number, limit: number): Block[] {
  const tip = heightAt(c, t);
  const out: Block[] = [];
  for (let h = tip; h > tip - limit && h > 0; h--) out.push(blockAt(c, h));
  return out;
}

/* ───────────────────────── transactions ───────────────────────── */

const TYPE_MIX: Record<string, { types: TxType[]; weights: number[] }> = {
  osmosis: { types: ['swap', 'send', 'ibc-transfer', 'delegate', 'claim', 'vote', 'undelegate', 'other'], weights: [52, 12, 16, 5, 7, 2, 2, 4] },
  default: { types: ['send', 'ibc-transfer', 'delegate', 'claim', 'vote', 'swap', 'undelegate', 'other'], weights: [36, 24, 11, 10, 6, 5, 3, 5] },
};
const ERRORS: Record<string, string> = {
  swap: 'slippage tolerance exceeded',
  send: 'insufficient funds',
  default: 'out of gas',
};
const MEMOS = ['', '', '', '', '', '', 'gm', 'thanks', 'invoice #1042', 'airdrop', 'rent', 'for the coffee'];
const SWAP_SYMBOLS = ['OSMO', 'ATOM', 'USDC', 'TIA'];

const mixFor = (c: ChainConfig): { types: TxType[]; weights: number[] } => TYPE_MIX[c.id] ?? (TYPE_MIX.default as { types: TxType[]; weights: number[] });

/** Transaction types that name a receiver account (staking messages name a validator instead). */
export const hasRecipient = (type: TxType): boolean => type === 'send' || type === 'ibc-transfer';

/** The type of the transaction in slot (height, index) — the same first draw `txAt` makes, without building the rest. */
export function txTypeAt(c: ChainConfig, height: number, index: number): TxType {
  const mix = mixFor(c);
  return pickWeighted(rngFor('tx', c.id, height, index), mix.types, mix.weights);
}

export function txAt(c: ChainConfig, height: number, index: number): Tx {
  const rng = rngFor('tx', c.id, height, index);
  const mix = mixFor(c);
  const type = pickWeighted(rng, mix.types, mix.weights);
  const time = blockTime(c, height);
  const failed = rng() < 0.03;
  const symbol = type === 'swap' ? (SWAP_SYMBOLS[Math.floor(rng() * SWAP_SYMBOLS.length)] as string) : c.symbol;
  const amount = Math.round(Math.exp(Math.log(0.05) + rng() * (Math.log(5000) - Math.log(0.05))) * 1e4) / 1e4;
  const feeUsd = 0.003 + rng() * 0.02;
  const gas = txGas(c, height, index);
  const needsRecipient = hasRecipient(type);
  const staking = type === 'delegate' || type === 'undelegate' || type === 'claim';
  const who = participantsAt(c, height, index);
  return {
    hash: encodeRef(c.id, 'tx', height, index),
    height,
    index,
    time,
    type,
    status: failed ? 'failed' : 'success',
    from: poolAddress(c, who.from),
    to: needsRecipient ? poolAddress(c, who.to) : staking ? validatorByUnit(c, unit('tv', c.id, height, index)).address : undefined,
    amount,
    symbol,
    feeAmount: Math.round((feeUsd / priceAt(c.symbol, time)) * 1e6) / 1e6,
    feeSymbol: c.symbol,
    memo: MEMOS[Math.floor(rng() * MEMOS.length)] as string,
    gasUsed: failed ? Math.round(gas.used * 0.4) : gas.used,
    gasWanted: gas.wanted,
    errorCode: failed ? (ERRORS[type] ?? ERRORS.default) : undefined,
  };
}

export function txsForBlock(c: ChainConfig, height: number): Tx[] {
  const n = txCountAt(c, height);
  return Array.from({ length: n }, (_, i) => txAt(c, height, i));
}

/** Newest-first transactions across the most recent blocks. */
export function latestTxs(c: ChainConfig, t: number, limit: number): Tx[] {
  const tip = heightAt(c, t);
  const out: Tx[] = [];
  for (let h = tip; out.length < limit && h > tip - 400 && h > 0; h--) {
    const n = txCountAt(c, h);
    for (let i = n - 1; i >= 0 && out.length < limit; i--) out.push(txAt(c, h, i));
  }
  return out;
}

export function findTx(c: ChainConfig, t: number, hash: string): Tx | null {
  const ref = decodeRef(c.id, hash);
  if (!ref || ref.kind !== 'tx' || ref.height > heightAt(c, t) || ref.height < 1) return null;
  if (ref.index >= txCountAt(c, ref.height)) return null;
  return txAt(c, ref.height, ref.index);
}

export function findBlockByHash(c: ChainConfig, t: number, hash: string): Block | null {
  const ref = decodeRef(c.id, hash);
  if (!ref || ref.kind !== 'block' || ref.height > heightAt(c, t) || ref.height < 1) return null;
  return blockAt(c, ref.height);
}
