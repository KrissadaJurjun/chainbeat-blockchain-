/**
 * Deterministic randomness for Demo Mode.
 * Everything simulated is a pure function of (seed, input) so data never "re-rolls" between renders
 * or page refreshes.
 */

export type Rng = () => number;

/** 32-bit string hash (FNV-1a with a murmur3 avalanche finaliser). Returns an unsigned integer. */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32 — small, fast, good-enough PRNG with a 32-bit state. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh generator seeded from any mix of strings / numbers. */
export function rngFor(...parts: Array<string | number>): Rng {
  return mulberry32(hashString(parts.join('|')));
}

/** A single deterministic value in [0, 1) for a key. Stateless. */
export function unit(...parts: Array<string | number>): number {
  return hashString(parts.join('|')) / 4294967296;
}

export const randInt = (rng: Rng, min: number, max: number): number => Math.floor(rng() * (max - min + 1)) + min;

export const randRange = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

/** Weighted pick; `weights` need not be normalised. */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return items[i] as T;
  }
  return items[items.length - 1] as T;
}

/** In-place Fisher–Yates shuffle driven by the supplied generator. */
export function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j] as T, items[i] as T];
  }
  return items;
}

/** Uppercase hexadecimal string of `bytes` random bytes. */
export function hexBytes(rng: Rng, bytes: number): string {
  let out = '';
  for (let i = 0; i < bytes; i++) out += Math.floor(rng() * 256).toString(16).padStart(2, '0');
  return out.toUpperCase();
}

export function randomBytes(rng: Rng, bytes: number): Uint8Array {
  const out = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) out[i] = Math.floor(rng() * 256);
  return out;
}
