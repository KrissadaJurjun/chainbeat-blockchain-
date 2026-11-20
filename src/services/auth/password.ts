import { AuthError } from './types';

/**
 * Password hashing and the password policy for the demo accounts.
 *
 * The hash is PBKDF2-HMAC-SHA512 with a random 16-byte salt (Web Crypto, 210 000 iterations — OWASP's figure for
 * that construction) and is stored as `pbkdf2-sha512$<iterations>$<salt>$<hash>`, so the cost can be raised later and
 * old records still verify. This protects against someone *reading* localStorage; it cannot make a browser-only
 * store secure — a script on the page, or the visitor themselves, can still replace the record (docs/AUTH.md).
 */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Mutable only so that tests can lower the cost; production code never changes it. */
export const passwordConfig = { iterations: 210_000 };

const SALT_BYTES = 16;
const HASH_BITS = 256;
const SCHEME = 'pbkdf2-sha512';
const encoder = new TextEncoder();

/** Web Crypto's `subtle` exists only in a secure context (https:// or localhost). */
export function cryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function' && typeof crypto.subtle?.deriveBits === 'function';
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!cryptoAvailable()) throw new AuthError('cryptoUnavailable');
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-512', salt, iterations }, key, HASH_BITS));
}

/** Comparison whose running time does not depend on where the two byte strings first differ. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function hashPassword(password: string, iterations: number = passwordConfig.iterations): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return [SCHEME, iterations, toBase64(salt), toBase64(hash)].join('$');
}

const DUMMY_SALT = new Uint8Array(SALT_BYTES);

/**
 * True when `password` matches `stored`. With no stored hash (unknown account, or a Google-only account) it still
 * performs one derivation, so that "no such account" and "wrong password" take about the same time.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) {
    await derive(password, DUMMY_SALT, passwordConfig.iterations);
    return false;
  }
  const [scheme, rounds, salt, hash] = stored.split('$');
  const iterations = Number(rounds);
  if (scheme !== SCHEME || !salt || !hash || !Number.isInteger(iterations) || iterations < 1) return false;
  try {
    return timingSafeEqual(await derive(password, fromBase64(salt), iterations), fromBase64(hash));
  } catch (e) {
    if (e instanceof AuthError) throw e;
    return false; // a corrupted record never verifies
  }
}

/* ───────────────────────── policy ───────────────────────── */

/** A short list of the passwords people use most (all at least 8 characters, since shorter ones fail anyway). */
const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'pa$$word', '12345678',
  '123456789', '1234567890', '123123123', '11111111', '00000000', '87654321', 'qwertyui', 'qwerty123', 'qwertyuiop',
  'asdfghjk', 'asdf1234', 'zxcvbnm1', 'iloveyou', 'iloveyou1', 'admin123', 'administrator', 'welcome1', 'welcome123',
  'letmein1', 'letmein123', 'abc12345', 'abcd1234', 'abcdefgh', 'monkey123', 'dragon123', 'sunshine1', 'princess1',
  'football1', 'baseball1', 'superman1', 'trustno1', 'master123', 'changeme', 'changeme1', 'chainbeat', 'chainbeat1',
  'chainbeat123', 'cosmos123', 'bitcoin1', 'bitcoin123', 'ethereum1', 'blockchain', 'blockchain1', 'crypto123',
]);

function isSequence(lower: string): boolean {
  if (lower.length < 2) return false;
  for (const step of [1, -1]) {
    let all = true;
    for (let i = 1; i < lower.length && all; i++) all = lower.charCodeAt(i) - lower.charCodeAt(i - 1) === step;
    if (all) return true;
  }
  return false;
}

export interface PasswordContext {
  username?: string;
  email?: string;
}

export interface PasswordCheck {
  /** 8 to 128 characters. */
  length: boolean;
  /** Contains at least one letter and one number. */
  mixed: boolean;
  /** Not on the common-password list, not one repeated character, not a simple run such as `abcdefgh`. */
  notCommon: boolean;
  /** Does not contain the username or the part of the email before the "@" (when those are at least 3 characters). */
  notPersonal: boolean;
  ok: boolean;
}

export function checkPassword(password: string, context: PasswordContext = {}): PasswordCheck {
  const lower = password.toLowerCase();
  const length = password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
  const mixed = /\p{L}/u.test(password) && /\p{N}/u.test(password);
  const notCommon = !COMMON.has(lower) && !/^(.)\1*$/su.test(password) && !isSequence(lower);
  const personal = [context.username, context.email?.split('@')[0]]
    .map((p) => p?.trim().toLowerCase() ?? '')
    .filter((p) => p.length >= 3);
  const notPersonal = personal.every((p) => !lower.includes(p));
  return { length, mixed, notCommon, notPersonal, ok: length && mixed && notCommon && notPersonal };
}

/** 0 = too short (or an obviously bad password) … 4 = strong. A rough guide for the meter, not a security guarantee. */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN) return 0;
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1*$/su.test(password) || isSequence(lower)) return 1;
  let score = password.length >= 16 ? 3 : password.length >= 12 ? 2 : 1;
  const classes = [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter((re) => re.test(password)).length;
  if (classes >= 3) score += 1;
  if (new Set(password).size < 5) score = Math.min(score, 1);
  return Math.min(4, score) as PasswordStrength;
}
