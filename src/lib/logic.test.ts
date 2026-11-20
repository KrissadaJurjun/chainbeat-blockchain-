import { describe, expect, it } from 'vitest';
import { bech32Encode } from '@/lib/bech32';
import { DEMO_FEE, DEMO_TX_PREFIX, isDemoTxHash, makeDemoTx } from '@/lib/demoTx';
import { applyDemoVote, GOV_PARAMS, mergeDemoProposals, projectedOutcome, tallyTokens } from '@/lib/governance';
import { hhi, powerCoefficient } from '@/lib/consensus';
import { classifyQuery, MAX_QUERY_LENGTH } from '@/lib/searchQuery';
import { endOfDayUtc, filterTxs, hasActiveTxFilters, parseTxFilters, txCsvRows, EMPTY_TX_FILTERS } from '@/lib/txFilters';
import { buildRawTx, txGroup } from '@/lib/txView';
import { getChain } from '@/services/chain/registry';
import type { Proposal, Tx, Validator } from '@/types/domain';

const hub = getChain('cosmoshub');
const address = (byte: number, prefix = 'cosmos') => bech32Encode(prefix, new Uint8Array(20).fill(byte));

describe('search query classification (no data source involved)', () => {
  it('recognises heights, hashes (with or without 0x), addresses, validator addresses and denoms', () => {
    expect(classifyQuery('  ', 'cosmos').kind).toBe('empty');
    expect(classifyQuery('1234567', 'cosmos')).toEqual({ kind: 'height', value: '1234567' });
    const hash = 'ab'.repeat(32);
    expect(classifyQuery(hash, 'cosmos')).toEqual({ kind: 'hash', value: hash.toUpperCase() });
    expect(classifyQuery('0x' + hash, 'cosmos').kind).toBe('hash');
    expect(classifyQuery(address(3), 'cosmos')).toMatchObject({ kind: 'address' });
    expect(classifyQuery(address(3, 'cosmosvaloper'), 'cosmos').kind).toBe('validatorAddress');
    expect(classifyQuery('uatom', 'cosmos').kind).toBe('denom');
    expect(classifyQuery('ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2', 'cosmos').kind).toBe('denom');
    expect(classifyQuery('Aurora Works', 'cosmos')).toEqual({ kind: 'text', value: 'Aurora Works' });
  });

  it('explains why an entry cannot be searched instead of failing silently', () => {
    expect(classifyQuery('ab'.repeat(20), 'cosmos')).toMatchObject({ kind: 'invalid', reason: 'badHash' }); // wrong length hash
    const broken = address(3).slice(0, -1) + (address(3).endsWith('q') ? 'p' : 'q');
    expect(classifyQuery(broken, 'cosmos')).toMatchObject({ kind: 'invalid', reason: 'badChecksum' });
    expect(classifyQuery(address(3, 'osmo'), 'cosmos').kind).not.toBe('address'); // another network's address
    expect(classifyQuery('x'.repeat(MAX_QUERY_LENGTH + 1), 'cosmos')).toMatchObject({ kind: 'invalid', reason: 'tooLong' });
    expect(classifyQuery('<script>alert(1)</script>', 'cosmos')).toMatchObject({ kind: 'invalid', reason: 'badChars' });
  });
});

const tx = (over: Partial<Tx>): Tx => ({
  hash: 'A'.repeat(64), height: 100, index: 0, time: Date.UTC(2026, 10, 18, 12), type: 'send', status: 'success', from: 'cosmos1sender', to: 'cosmos1receiver',
  amount: 5, symbol: 'ATOM', feeAmount: 0.0025, feeSymbol: 'ATOM', memo: '', gasUsed: 100_000, gasWanted: 120_000, ...over,
});

describe('transaction filtering and CSV export', () => {
  const list = [tx({ hash: 'AA11' + '0'.repeat(60), type: 'send' }), tx({ hash: 'BB22' + '0'.repeat(60), type: 'delegate', status: 'failed', height: 101 }), tx({ hash: 'CC33' + '0'.repeat(60), type: 'swap', from: 'osmo1trader', to: undefined, height: 102 })];

  it('filters by free text (hash, address or exact height), category and status', () => {
    expect(filterTxs(list, { ...EMPTY_TX_FILTERS, q: 'bb22' })).toHaveLength(1);
    expect(filterTxs(list, { ...EMPTY_TX_FILTERS, q: 'osmo1trader' })).toHaveLength(1);
    expect(filterTxs(list, { ...EMPTY_TX_FILTERS, q: '101' })).toHaveLength(1);
    expect(filterTxs(list, { ...EMPTY_TX_FILTERS, group: 'staking' }).map((x) => x.type)).toEqual(['delegate']);
    expect(filterTxs(list, { ...EMPTY_TX_FILTERS, status: 'failed' })).toHaveLength(1);
    expect(filterTxs(list, { ...EMPTY_TX_FILTERS, group: 'transfer', status: 'failed' })).toHaveLength(0);
    expect(filterTxs(list, EMPTY_TX_FILTERS)).toHaveLength(3);
  });

  it('reads filters from the URL and ignores anything invalid', () => {
    expect(parseTxFilters(new URLSearchParams('q=abc&group=ibc&status=failed&date=2026-11-01'))).toEqual({ q: 'abc', group: 'ibc', status: 'failed', date: '2026-11-01' });
    expect(parseTxFilters(new URLSearchParams('group=nonsense&status=maybe&date=11/01/2026'))).toEqual(EMPTY_TX_FILTERS);
    expect(hasActiveTxFilters(EMPTY_TX_FILTERS)).toBe(false);
    expect(hasActiveTxFilters({ ...EMPTY_TX_FILTERS, status: 'failed' })).toBe(true);
  });

  it('treats a date as "up to the end of that UTC day"', () => {
    expect(endOfDayUtc('2026-11-18')).toBe(Date.UTC(2026, 10, 19) - 1);
    expect(endOfDayUtc('2026-13-45')).toBeNull();
    expect(endOfDayUtc('')).toBeNull();
  });

  it('exports a header row plus one row per transaction, with ISO timestamps and raw amounts', () => {
    const rows = txCsvRows(list, ['hash', 'block']);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual(['hash', 'block']);
    expect(rows[1]?.[10]).toBe('2026-11-18T12:00:00.000Z');
    expect(rows[1]?.[6]).toBe(5);
    expect(rows[3]?.[5]).toBe(''); // no receiver → empty cell, never "undefined"
  });

  it('maps every transaction type to one of the filter categories', () => {
    expect(txGroup('send')).toBe('transfer');
    expect(txGroup('delegate')).toBe('staking');
    expect(txGroup('vote')).toBe('governance');
    expect(txGroup('ibc-transfer')).toBe('ibc');
    expect(txGroup('swap')).toBe('swap');
  });
});

const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  id: 7, title: 't', summary: 's', description: 'd', type: 'text', status: 'voting', submitTime: 0, votingEnd: 1, deposit: 500, minDeposit: 500,
  tally: { yes: 0.5, no: 0.3, abstain: 0.1, veto: 0.1 }, turnout: 0.5, proposer: address(1), ...over,
});

describe('governance maths', () => {
  it('counts a demo vote into the tally consistently: fractions still sum to 1, turnout grows', () => {
    const bonded = 1_000_000;
    const before = proposal();
    const after = applyDemoVote(before, 'no', 100_000, bonded);
    expect(Object.values(after.tally).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(after.turnout).toBeCloseTo(0.6, 10);
    expect(after.tally.no).toBeGreaterThan(before.tally.no);
    expect(after.tally.yes).toBeLessThan(before.tally.yes);
    // the token counts behind the tally add up to the votes cast
    const tokens = tallyTokens(after, bonded);
    expect(Object.values(tokens).reduce((a, b) => a + b, 0)).toBeCloseTo(after.turnout * bonded, 4);
    expect(tokens.no - tallyTokens(before, bonded).no).toBeCloseTo(100_000, 4);
  });

  it('changes nothing without an option, a weight or bonded tokens', () => {
    const p = proposal();
    expect(applyDemoVote(p, undefined, 10, 100)).toBe(p);
    expect(applyDemoVote(p, 'yes', 0, 100)).toBe(p);
    expect(applyDemoVote(p, 'yes', 10, 0)).toBe(p);
  });

  it('projects the outcome from quorum, the Yes threshold among decisive votes and the veto limit', () => {
    expect(projectedOutcome(proposal({ turnout: GOV_PARAMS.quorum - 0.01 }))).toBe('noQuorum');
    expect(projectedOutcome(proposal({ tally: { yes: 0.2, no: 0.2, abstain: 0.1, veto: 0.5 } }))).toBe('vetoed');
    expect(projectedOutcome(proposal({ tally: { yes: 0.6, no: 0.2, abstain: 0.15, veto: 0.05 } }))).toBe('passing');
    expect(projectedOutcome(proposal({ tally: { yes: 0.3, no: 0.5, abstain: 0.15, veto: 0.05 } }))).toBe('failing');
  });

  it('adds demo proposals (this network only) to the list, newest first, and to the counts', () => {
    const data = { live: 2, total: 10, items: [proposal({ id: 10 }), proposal({ id: 9 })] };
    const mine = { key: 'k1', chainId: 'cosmoshub', id: 11, title: 'Mine', description: 'x', type: 'text' as const, deposit: 500, symbol: 'ATOM', submittedAt: Date.now() };
    const other = { ...mine, key: 'k2', chainId: 'osmosis', id: 12 };
    const merged = mergeDemoProposals(data, [mine, other], hub, 500, address(1));
    expect(merged.total).toBe(11);
    expect(merged.items.map((p) => p.id)).toEqual([11, 10, 9]);
    expect(merged.items[0]?.demo).toBe(true);
    expect(mergeDemoProposals(data, [other], hub, 500, address(1))).toBe(data);
  });

  it('ends a demo proposal after the voting period chosen for it, or the network\'s own when none was chosen', () => {
    const DAY = 86_400_000;
    const at = Date.UTC(2026, 10, 18);
    const base = { key: 'k1', chainId: 'cosmoshub', id: 11, title: 'Mine', description: 'x', type: 'other' as const, deposit: 500, symbol: 'ATOM', submittedAt: at };
    const data = { live: 0, total: 10, items: [proposal({ id: 10 })] };
    const [short] = mergeDemoProposals(data, [{ ...base, votingDays: 3 }], hub, 500, address(1)).items;
    expect(short?.type).toBe('other');
    expect((short?.votingEnd ?? 0) - (short?.submitTime ?? 0)).toBe(3 * DAY);
    const [network] = mergeDemoProposals(data, [base], hub, 500, address(1)).items;
    expect((network?.votingEnd ?? 0) - (network?.submitTime ?? 0)).toBe(hub.votingPeriodDays * DAY);
  });
});

const validator = (rank: number, votingPower: number, status: Validator['status'] = 'active'): Validator => ({
  rank, moniker: 'v' + rank, operatorAddress: 'x' + rank, tokens: 1, votingPower, cumulativePower: 0, commission: 0.05, uptime: 0.99, status, change24h: 0, delegators: 1,
});

describe('decentralisation metrics', () => {
  it('finds the fewest validators above a power threshold and ignores inactive ones', () => {
    const set = [validator(1, 0.2), validator(2, 0.15), validator(3, 0.1), validator(4, 0.05), validator(5, 0.5, 'jailed')];
    expect(powerCoefficient(set, 1 / 3)).toBe(2); // 0.2 + 0.15 > 1/3
    expect(powerCoefficient(set, 0.9)).toBe(4); // never exceeds → all active validators
  });

  it('scores concentration with the Herfindahl–Hirschman index (0–10,000)', () => {
    expect(hhi([validator(1, 1)])).toBe(10_000);
    expect(hhi(Array.from({ length: 10 }, (_, i) => validator(i, 0.1)))).toBeCloseTo(1_000, 6);
  });
});

describe('Demo wallet transactions', () => {
  const input = { type: 'send' as const, from: address(1), to: address(2), amount: 3, symbol: 'ATOM', seed: 'act-1' };

  it('are deterministic, clearly synthetic and fee-bearing', () => {
    const at = Date.UTC(2026, 10, 18);
    const a = makeDemoTx(hub, at, input);
    expect(makeDemoTx(hub, at, input)).toEqual(a);
    expect(makeDemoTx(hub, at, { ...input, seed: 'act-2' }).hash).not.toBe(a.hash);
    expect(a.hash.startsWith(DEMO_TX_PREFIX)).toBe(true);
    expect(a.hash).toHaveLength(64);
    expect(isDemoTxHash(a.hash)).toBe(true);
    expect(isDemoTxHash('AB'.repeat(32))).toBe(false);
    expect([a.feeAmount, a.status]).toEqual([DEMO_FEE, 'success']);
    expect(a.gasUsed).toBeLessThan(a.gasWanted);
  });

  it('render as a raw JSON document that carries the same hash and receiver', () => {
    const t = makeDemoTx(hub, Date.UTC(2026, 10, 18), input);
    const raw = JSON.stringify(buildRawTx(t, hub));
    expect(raw).toContain(t.hash);
    expect(raw).toContain(address(2));
  });
});
