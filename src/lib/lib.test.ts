import { describe, expect, it } from 'vitest';
import { bech32Decode, bech32Encode, checkAddress } from './bech32';
import { niceTicks, niceTimeTicks, monotonePath } from './chart';
import { toCsv } from './csv';
import { createFormatter } from './format';
import { hashString, mulberry32, rngFor, shuffle, unit } from './prng';
import { createSpectrum } from './noise';
import { parseAmount, floorTo } from './validation';
import { shortHash } from './utils';

describe('prng — determinism', () => {
  it('hashes strings stably', () => {
    expect(hashString('chainbeat')).toBe(hashString('chainbeat'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });

  it('produces the same sequence for the same seed and a different one otherwise', () => {
    const a = Array.from({ length: 5 }, mulberry32(42));
    const b = Array.from({ length: 5 }, mulberry32(42));
    const c = Array.from({ length: 5 }, mulberry32(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('unit() is stateless and shuffle() is a deterministic permutation', () => {
    expect(unit('k', 1, 2)).toBe(unit('k', 1, 2));
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = shuffle(rngFor('x'), [...input]);
    const s2 = shuffle(rngFor('x'), [...input]);
    expect(s1).toEqual(s2);
    expect([...s1].sort()).toEqual(input);
  });
});

describe('noise — spectral signal is a pure function of time', () => {
  it('returns identical values for identical timestamps and varies smoothly', () => {
    const f = createSpectrum('t', { minPeriodMs: 3_000_000, maxPeriodMs: 4e10 });
    const t = Date.UTC(2026, 10, 18, 12);
    expect(f(t)).toBe(f(t));
    expect(Math.abs(f(t + 60_000) - f(t))).toBeLessThan(0.2); // one minute apart: nearly the same
  });
});

describe('bech32', () => {
  it('decodes the BIP-173 reference vector', () => {
    const decoded = bech32Decode('A12UEL5L');
    expect(decoded?.hrp).toBe('a');
    expect(decoded?.bytes.length).toBe(0);
  });

  it('round-trips 20-byte account addresses and validates the checksum', () => {
    const bytes = Uint8Array.from({ length: 20 }, (_, i) => i * 7 + 3);
    const address = bech32Encode('cosmos', bytes);
    expect(address.startsWith('cosmos1')).toBe(true);
    expect(checkAddress(address, 'cosmos')).toEqual({ ok: true, hrp: 'cosmos' });
    const corrupted = `${address.slice(0, -1)}${address.endsWith('q') ? 'p' : 'q'}`;
    expect(checkAddress(corrupted, 'cosmos')).toEqual({ ok: false, reason: 'format' });
  });

  it('reports a wrong prefix, wrong payload length and mixed case', () => {
    const osmo = bech32Encode('osmo', new Uint8Array(20).fill(9));
    expect(checkAddress(osmo, 'cosmos')).toEqual({ ok: false, reason: 'prefix' });
    expect(checkAddress(bech32Encode('cosmos', new Uint8Array(10).fill(1)), 'cosmos')).toEqual({ ok: false, reason: 'length' });
    const mixed = osmo.slice(0, 6) + osmo.slice(6).toUpperCase();
    expect(checkAddress(mixed, 'osmo').ok).toBe(false);
  });
});

describe('chart helpers', () => {
  it('niceTicks covers the data range with round steps', () => {
    const ticks = niceTicks(83.2, 108.9, 6);
    expect(ticks[0]).toBeLessThanOrEqual(83.2);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(108.9);
    const steps = new Set(ticks.slice(1).map((t, i) => Math.round((t - (ticks[i] as number)) * 1e6)));
    expect(steps.size).toBe(1);
  });

  it('monotonePath never overshoots the data (no phantom highs between samples)', () => {
    const path = monotonePath([[0, 10], [10, 10], [20, 0], [30, 0]]);
    expect(path.startsWith('M0 10')).toBe(true);
    const ys = [...path.matchAll(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map((m) => Number(m[2]));
    expect(Math.max(...ys)).toBeLessThanOrEqual(10.0001);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.0001);
  });

  it('niceTimeTicks gives unique, in-range, calendar-aligned ticks', () => {
    const t1 = Date.UTC(2026, 10, 18, 7, 13);
    const t0 = t1 - 7 * 86_400_000;
    const { ticks, step } = niceTimeTicks(t0, t1, 8);
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks.length).toBeLessThanOrEqual(9);
    expect(ticks.every((t) => t >= t0 && t <= t1)).toBe(true);
    expect(step).toBeGreaterThanOrEqual(86_400_000);
    const days = ticks.map((t) => new Date(t).toDateString());
    expect(new Set(days).size).toBe(days.length); // never two ticks on the same calendar day
  });
});

describe('format', () => {
  const en = createFormatter('en');
  it('formats numbers, percentages and compact values', () => {
    expect(en.integer(24_254_118)).toBe('24,254,118');
    expect(en.percent(0.1005, 2)).toBe('10.05%');
    expect(en.signedPercent(0.012, 1)).toBe('+1.2%');
    expect(en.signedPercent(-0.034, 1)).toBe('-3.4%');
    expect(en.compact(434_640_000)).toBe('434.64M');
    expect(en.usdCompact(55_520_000)).toBe('$55.52M');
    expect(en.token(1250.5, 'ATOM')).toBe('1,250.5 ATOM');
  });

  it('never prints NaN/Infinity', () => {
    expect(en.integer(Number.NaN)).toBe('0');
    expect(en.percent(Number.POSITIVE_INFINITY)).toBe('0.00%');
  });

  it('uses Latin K/M/B for Arabic compact numbers so they fit compact UI', () => {
    expect(createFormatter('ar-u-nu-latn').compact(1_234_567)).toBe('1.23M');
  });

  it('caps CJK compact figures at four significant digits and prints a bare "$" in every language', () => {
    const zh = createFormatter('zh-CN');
    expect(zh.compact(8_119_900)).toBe('812万'); // not "811.99万"
    expect(zh.compact(567_340_000)).toBe('5.67亿');
    expect(zh.usdCompact(54_629_500)).toBe('$5463万'); // not "US$5462.95万"
    expect(createFormatter('ja-JP').usdCompact(54_629_500)).toBe('$5463万');
    expect(createFormatter('de').usdCompact(54_629_500)).toMatch(/^54,63\s+Mio\.\s*\$$/);
    expect(zh.currency(6.82)).toBe('$6.82');
  });

  it('formats relative time and selects CLDR plural categories per language', () => {
    expect(en.relative(Date.now() - 2 * 3_600_000, Date.now())).toMatch(/2 hr\. ago|2 hours ago/);
    const ru = createFormatter('ru');
    expect([1, 3, 5].map((n) => ru.plural(n))).toEqual(['one', 'few', 'many']);
    const ar = createFormatter('ar');
    expect([0, 1, 2, 5, 11, 100].map((n) => ar.plural(n))).toEqual(['zero', 'one', 'two', 'few', 'many', 'other']);
    expect(createFormatter('th').plural(1)).toBe('other');
  });
});

describe('validation, csv and misc helpers', () => {
  it('parses user-typed decimals', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('1234,56')).toBe(1234.56);
    expect(parseAmount(' .5 ')).toBe(0.5);
    for (const bad of ['', 'abc', '1e5', '--1', '1.2.3', '1,2,3.4x']) expect(Number.isNaN(parseAmount(bad))).toBe(true);
  });

  it('floors (never rounds up) so a user can never spend more than they hold', () => {
    expect(floorTo(1.2999999, 3)).toBe(1.299);
    expect(floorTo(0.1 + 0.2, 6)).toBe(0.3);
  });

  it('escapes CSV fields', () => {
    expect(toCsv([['a', 'b,c', 'd"e', 'f\ng', 1, null]])).toBe('a,"b,c","d""e","f\ng",1,');
  });

  it('shortens hashes only when needed', () => {
    expect(shortHash('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6, 4)).toBe('ABCDEF…WXYZ');
    expect(shortHash('ABC', 6, 4)).toBe('ABC');
  });
});
