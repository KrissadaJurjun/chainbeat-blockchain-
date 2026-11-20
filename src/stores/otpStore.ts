import { create } from 'zustand';
import { uid } from '@/lib/utils';
import {
  OTP_MAX_SENDS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_SEND_WINDOW_MS,
  OTP_TTL_MS,
  OTP_VERIFIED_GRACE_MS,
  checkCode,
  generateCode,
  type OtpChallenge,
  type OtpCheck,
} from '@/services/auth/otp';
import { AuthError, type OtpPurpose } from '@/services/auth/types';

/**
 * One-time codes and the Demo inbox. **In memory only, never persisted**: a reload forgets every pending code and
 * message, which is what a visitor would expect from "start again". See docs/AUTH.md for why the inbox exists.
 */

/** What "sending" means for a request: a real code, a "no such account" notice, or nothing at all. */
export type Delivery = 'code' | 'no-account' | 'none';

export interface InboxMessage {
  id: string;
  kind: 'code' | 'no-account';
  purpose: OtpPurpose;
  to: string;
  /** The code, for `kind: 'code'`. */
  code: string | null;
  sentAt: number;
  validForMinutes: number;
}

/** What the UI needs to know about a code that was just requested. The code itself is only in the inbox. */
export interface IssuedChallenge {
  id: string;
  purpose: OtpPurpose;
  target: string;
  expiresAt: number;
  /** When another code may be requested. */
  resendAt: number;
}

const MAX_INBOX = 20;

interface OtpState {
  challenges: Record<string, OtpChallenge>;
  /** `purpose|target` → timestamps of recent sends (rate limit). */
  sends: Record<string, number[]>;
  inbox: InboxMessage[];
  /** Counts deliveries so the inbox can announce a new message. */
  arrivals: number;

  request: (purpose: OtpPurpose, target: string, delivery: Delivery, now?: number) => IssuedChallenge;
  verify: (challengeId: string, code: string, now?: number) => OtpCheck;
  /** The verified challenge for `purpose`, or throws `otpRequired`. Does not use it up. */
  requireVerified: (challengeId: string, purpose: OtpPurpose, now?: number) => OtpChallenge;
  /** Makes a challenge single-use: call it once the step it unlocked has succeeded. */
  markConsumed: (challengeId: string) => void;
  clearInbox: () => void;
  reset: () => void;
}

const initial = (): Pick<OtpState, 'challenges' | 'sends' | 'inbox' | 'arrivals'> => ({ challenges: {}, sends: {}, inbox: [], arrivals: 0 });

export const useOtpStore = create<OtpState>()((set, get) => ({
  ...initial(),

  request: (purpose, target, delivery, now = Date.now()) => {
    const key = `${purpose}|${target}`;
    const recent = (get().sends[key] ?? []).filter((at) => now - at < OTP_SEND_WINDOW_MS);
    const last = recent[recent.length - 1];
    if (last !== undefined && now - last < OTP_RESEND_COOLDOWN_MS) {
      throw new AuthError('rateLimited', { retryAfterMs: OTP_RESEND_COOLDOWN_MS - (now - last) });
    }
    if (recent.length >= OTP_MAX_SENDS) {
      throw new AuthError('rateLimited', { retryAfterMs: (recent[0] ?? now) + OTP_SEND_WINDOW_MS - now });
    }

    const challenge: OtpChallenge = {
      id: uid('otp'),
      purpose,
      target,
      key,
      code: delivery === 'code' ? generateCode() : '',
      createdAt: now,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      verifiedAt: null,
      consumed: false,
    };
    const message: InboxMessage | null =
      delivery === 'none'
        ? null
        : { id: uid('msg'), kind: delivery, purpose, to: target, code: delivery === 'code' ? challenge.code : null, sentAt: now, validForMinutes: OTP_TTL_MS / 60_000 };

    set((s) => {
      // a new code replaces the earlier ones for the same purpose and address; long-finished challenges are dropped
      const challenges: Record<string, OtpChallenge> = {};
      for (const [id, c] of Object.entries(s.challenges)) if (c.key !== key && now <= c.expiresAt + OTP_VERIFIED_GRACE_MS) challenges[id] = c;
      challenges[challenge.id] = challenge;
      return {
        challenges,
        sends: { ...s.sends, [key]: [...recent, now] },
        inbox: message ? [message, ...s.inbox].slice(0, MAX_INBOX) : s.inbox,
        arrivals: s.arrivals + (message ? 1 : 0),
      };
    });
    return { id: challenge.id, purpose, target, expiresAt: challenge.expiresAt, resendAt: now + OTP_RESEND_COOLDOWN_MS };
  },

  verify: (challengeId, code, now = Date.now()) => {
    const challenge = get().challenges[challengeId];
    if (!challenge) return { ok: false, reason: 'expired', attemptsLeft: 0 };
    const { next, result } = checkCode(challenge, code, now);
    if (next !== challenge) set((s) => ({ challenges: { ...s.challenges, [challengeId]: next } }));
    return result;
  },

  requireVerified: (challengeId, purpose, now = Date.now()) => {
    const c = get().challenges[challengeId];
    if (!c || c.purpose !== purpose || c.consumed || c.verifiedAt === null || now - c.verifiedAt > OTP_VERIFIED_GRACE_MS) throw new AuthError('otpRequired');
    return c;
  },

  markConsumed: (challengeId) =>
    set((s) => {
      const c = s.challenges[challengeId];
      return c ? { challenges: { ...s.challenges, [challengeId]: { ...c, consumed: true } } } : s;
    }),

  clearInbox: () => set({ inbox: [] }),
  reset: () => set(initial()),
}));
