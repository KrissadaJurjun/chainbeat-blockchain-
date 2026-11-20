import type { OtpPurpose } from './types';

/**
 * One-time codes (OTP) for the demo accounts: generation and the rules for checking one.
 *
 * Nothing here talks to a network. A code is created in the browser, "delivered" to the on-page Demo inbox
 * (`stores/otpStore.ts`) and checked in the browser; it is never written to storage. A production system would
 * generate, store (hashed) and check codes on a server and deliver them by email or SMS (docs/AUTH.md).
 */

export const OTP_LENGTH = 6;
/** How long a code can be entered. */
export const OTP_TTL_MS = 5 * 60_000;
/** Wrong guesses allowed per code before it is locked. */
export const OTP_MAX_ATTEMPTS = 5;
/** Minimum wait before another code can be requested for the same purpose and address. */
export const OTP_RESEND_COOLDOWN_MS = 30_000;
/** At most this many codes per purpose and address within the window. */
export const OTP_MAX_SENDS = 5;
export const OTP_SEND_WINDOW_MS = 15 * 60_000;
/** After a code has been verified, the next step (set a password, show the username) must happen within this time. */
export const OTP_VERIFIED_GRACE_MS = 10 * 60_000;

/** Fills `bytes` with random values. Replaceable in tests. */
export type RandomFill = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
const systemRandom: RandomFill = (bytes) => crypto.getRandomValues(bytes);

/**
 * A uniformly random numeric code (leading zeros allowed). Bytes ≥ 250 are discarded so that every digit is exactly as
 * likely as every other (256 is not a multiple of 10, so a plain `byte % 10` would favour 0–5).
 */
export function generateCode(length: number = OTP_LENGTH, fill: RandomFill = systemRandom): string {
  let out = '';
  while (out.length < length) {
    for (const byte of fill(new Uint8Array(length * 2))) {
      if (byte < 250 && out.length < length) out += String(byte % 10);
    }
  }
  return out;
}

export function randomHex(bytes: number, fill: RandomFill = systemRandom): string {
  return Array.from(fill(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Equality whose running time does not reveal how many leading characters matched. */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Keeps the digits only, so "483 920" and "483-920" (as pasted from an email) are accepted. */
export const normaliseCode = (input: string): string => input.replace(/\D/g, '');

export interface OtpChallenge {
  id: string;
  purpose: OtpPurpose;
  /** The address the code was sent to (an email), or the username that was typed for a reset; lower-case. */
  target: string;
  /** `purpose|target`, used to look up earlier codes and rate-limit sends. */
  key: string;
  /** The code, kept in memory only. Empty for a "decoy": the request was accepted but no code exists (see flows.ts). */
  code: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  verifiedAt: number | null;
  consumed: boolean;
}

export type OtpCheck = { ok: true } | { ok: false; reason: 'invalid' | 'expired' | 'locked'; attemptsLeft: number };

/**
 * Checks `input` against a challenge and returns the updated challenge together with the verdict. A wrong guess uses up
 * an attempt; after {@link OTP_MAX_ATTEMPTS} the challenge is locked even for the right code. A decoy never verifies.
 */
export function checkCode(challenge: OtpChallenge, input: string, now: number): { next: OtpChallenge; result: OtpCheck } {
  if (challenge.consumed) return { next: challenge, result: { ok: false, reason: 'expired', attemptsLeft: 0 } };
  if (challenge.verifiedAt !== null) return { next: challenge, result: { ok: true } };
  if (now > challenge.expiresAt) return { next: challenge, result: { ok: false, reason: 'expired', attemptsLeft: 0 } };
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) return { next: challenge, result: { ok: false, reason: 'locked', attemptsLeft: 0 } };

  const matches = challenge.code !== '' && constantTimeEqual(normaliseCode(input), challenge.code);
  if (matches) return { next: { ...challenge, verifiedAt: now }, result: { ok: true } };

  const attempts = challenge.attempts + 1;
  const attemptsLeft = OTP_MAX_ATTEMPTS - attempts;
  return {
    next: { ...challenge, attempts },
    result: attemptsLeft > 0 ? { ok: false, reason: 'invalid', attemptsLeft } : { ok: false, reason: 'locked', attemptsLeft: 0 },
  };
}
