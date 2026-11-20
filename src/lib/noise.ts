import { hashString, mulberry32 } from './prng';

/** Fixed reference instant for the simulation (2024-01-01T00:00:00Z). */
export const SIM_EPOCH_MS = Date.UTC(2024, 0, 1);
/** The instant at which each chain's configured "headline" figures are exactly true (2026-11-18T00:00:00Z). */
export const SIM_TARGET_MS = Date.UTC(2026, 10, 18);

export type Spectrum = (tMs: number) => number;

interface SpectrumOptions {
  minPeriodMs: number;
  maxPeriodMs: number;
  /** Components per octave of period. Higher = richer texture. */
  perOctave?: number;
  /** 0.5 ≈ random walk (amplitude ∝ √period); 0 = white-ish; 1 = very smooth. */
  hurst?: number;
}

/**
 * Deterministic, smooth, random-walk-like signal that is a PURE FUNCTION OF TIME.
 *
 * Instead of stepping a random walk (which needs state and a fixed start), we sum sine waves with seeded
 * phases whose amplitudes grow with period. The result has roughly unit standard deviation, looks like
 * a plausible price path at every zoom level (24h … 90d), and — crucially — evaluating it at the same
 * timestamp always gives the same value, so charts are stable across refreshes and ranges agree.
 */
export function createSpectrum(seed: string, options: SpectrumOptions): Spectrum {
  const { minPeriodMs, maxPeriodMs, perOctave = 2.2, hurst = 0.5 } = options;
  const rng = mulberry32(hashString(`spectrum:${seed}`));
  const octaves = Math.log2(maxPeriodMs / minPeriodMs);
  const n = Math.max(2, Math.round(octaves * perOctave));
  const periods = new Float64Array(n);
  const phases = new Float64Array(n);
  const amps = new Float64Array(n);
  let variance = 0;
  for (let k = 0; k < n; k++) {
    const p = minPeriodMs * Math.pow(maxPeriodMs / minPeriodMs, k / (n - 1)) * (0.88 + rng() * 0.24);
    const a = Math.pow(p / minPeriodMs, hurst);
    periods[k] = p;
    phases[k] = rng() * Math.PI * 2;
    amps[k] = a;
    variance += (a * a) / 2;
  }
  const norm = 1 / Math.sqrt(variance);
  for (let k = 0; k < n; k++) amps[k] = (amps[k] as number) * norm;
  const TWO_PI = Math.PI * 2;

  return (t: number) => {
    const x = t - SIM_EPOCH_MS;
    let sum = 0;
    for (let k = 0; k < n; k++) sum += (amps[k] as number) * Math.sin((TWO_PI * x) / (periods[k] as number) + (phases[k] as number));
    return sum;
  };
}

const cache = new Map<string, Spectrum>();

/** Memoised spectrum lookup (spectra are immutable, so sharing is safe). */
export function spectrum(seed: string, options: SpectrumOptions): Spectrum {
  const key = `${seed}|${options.minPeriodMs}|${options.maxPeriodMs}|${options.perOctave ?? ''}|${options.hurst ?? ''}`;
  let s = cache.get(key);
  if (!s) {
    s = createSpectrum(seed, options);
    cache.set(key, s);
  }
  return s;
}

const MIN = 60_000;
const DAY = 86_400_000;

/** Slowly varying signal (periods of days → months) for quantities like inflation or bonded ratio. */
export const slowNoise = (seed: string): Spectrum => spectrum(seed, { minPeriodMs: 2 * DAY, maxPeriodMs: 120 * DAY, perOctave: 1.6, hurst: 0.35 });

const anchored = new Map<string, Spectrum>();

/**
 * Like `slowNoise`, but exactly 0 at SIM_TARGET_MS. Headline figures (inflation, bonded ratio, tx/block…)
 * are therefore exactly the configured values on the reference day and drift plausibly from there.
 */
export const slowNoiseFromTarget = (seed: string): Spectrum => {
  let f = anchored.get(seed);
  if (!f) {
    const base = slowNoise(seed);
    const zero = base(SIM_TARGET_MS);
    f = (t: number) => base(t) - zero;
    anchored.set(seed, f);
  }
  return f;
};

/** Price-like signal: 50-minute wiggles up to ~1.5-year swings. */
export const priceNoise = (seed: string): Spectrum => spectrum(seed, { minPeriodMs: 50 * MIN, maxPeriodMs: 540 * DAY, perOctave: 2.4, hurst: 0.5 });
