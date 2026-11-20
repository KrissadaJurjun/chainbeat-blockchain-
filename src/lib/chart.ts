/** Small, dependency-free helpers for the hand-drawn SVG charts. */

export type Pt = readonly [number, number];

/** "Nice" axis ticks covering [min, max] (about `count` of them). */
export function niceTicks(min: number, max: number, count = 6): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const rough = (max - min) / Math.max(1, count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / magnitude;
  const step = (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step * 0.5; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson). Gives a smooth curve that never overshoots the data,
 * which matters for financial series: no phantom highs/lows between samples.
 */
export function monotonePath(points: readonly Pt[]): string {
  const n = points.length;
  if (n === 0) return '';
  const first = points[0] as Pt;
  if (n === 1) return `M${first[0]} ${first[1]}`;

  const dx: number[] = [];
  const d: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    const a = points[k] as Pt;
    const b = points[k + 1] as Pt;
    dx.push(b[0] - a[0]);
    d.push(b[0] === a[0] ? 0 : (b[1] - a[1]) / (b[0] - a[0]));
  }
  const m: number[] = new Array<number>(n);
  m[0] = d[0] as number;
  m[n - 1] = d[n - 2] as number;
  for (let k = 1; k < n - 1; k++) {
    const p = d[k - 1] as number;
    const q = d[k] as number;
    m[k] = p * q <= 0 ? 0 : (p + q) / 2;
  }
  for (let k = 0; k < n - 1; k++) {
    const dk = d[k] as number;
    if (dk === 0) {
      m[k] = 0;
      m[k + 1] = 0;
    } else {
      const a = (m[k] as number) / dk;
      const b = (m[k + 1] as number) / dk;
      const s = a * a + b * b;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        m[k] = tau * a * dk;
        m[k + 1] = tau * b * dk;
      }
    }
  }

  const f = (v: number): string => (Math.round(v * 100) / 100).toString();
  let path = `M${f(first[0])} ${f(first[1])}`;
  for (let k = 0; k < n - 1; k++) {
    const a = points[k] as Pt;
    const b = points[k + 1] as Pt;
    const h = (dx[k] as number) / 3;
    path += `C${f(a[0] + h)} ${f(a[1] + (m[k] as number) * h)} ${f(b[0] - h)} ${f(b[1] - (m[k + 1] as number) * h)} ${f(b[0])} ${f(b[1])}`;
  }
  return path;
}

/** Evenly spaced indices (inclusive of both ends) for axis labels. */
export function spreadIndices(length: number, count: number): number[] {
  if (length <= 0) return [];
  if (count <= 1 || length === 1) return [0];
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(Math.round((i * (length - 1)) / (count - 1)));
  return Array.from(new Set(out));
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const TIME_STEPS = [HOUR, 2 * HOUR, 3 * HOUR, 4 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 3 * DAY, 5 * DAY, 7 * DAY, 10 * DAY, 14 * DAY, 30 * DAY];

/**
 * Axis ticks on real local hour / day boundaries (never two ticks on the same calendar day),
 * at most `maxCount` of them. `step` tells the caller whether to label with a time or a date.
 */
export function niceTimeTicks(t0: number, t1: number, maxCount: number): { ticks: number[]; step: number } {
  const span = Math.max(1, t1 - t0);
  const step = TIME_STEPS.find((s) => span / s <= Math.max(2, maxCount)) ?? (TIME_STEPS[TIME_STEPS.length - 1] as number);
  const offset = new Date(t0).getTimezoneOffset() * 60_000; // local alignment (DST drift is irrelevant for labels)
  const first = Math.ceil((t0 - offset) / step) * step + offset;
  const ticks: number[] = [];
  for (let t = first; t <= t1; t += step) ticks.push(t);
  // a sub-day step over a span of a full day or more would label the first and last tick identically ("6 AM … 6 AM")
  if (step < DAY && ticks.length > 1 && (ticks[ticks.length - 1] as number) - (ticks[0] as number) >= DAY) ticks.pop();
  return { ticks, step };
}

export const TIME_DAY = DAY;