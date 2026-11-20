/**
 * Types shared by the demo-account code (see docs/AUTH.md). Everything here lives in the visitor's browser:
 * there is no server, so "accounts" are records in localStorage and "sending" a one-time code means putting a
 * message in the on-page Demo inbox.
 */

/** How a visitor signed in. `google-demo` is the clearly-labelled simulation used while no Google client ID is set. */
export type AuthMethod = 'password' | 'google' | 'google-demo';

/** What a one-time code is for. */
export type OtpPurpose = 'register' | 'reset-password' | 'recover-username';

export interface AuthAccount {
  id: string;
  /** As typed by the visitor; uniqueness is case-insensitive. */
  username: string;
  /** Lower-case. */
  email: string;
  /** `pbkdf2-sha512$<iterations>$<salt>$<hash>`; null for an account that was created through Google. */
  passwordHash: string | null;
  /** Google's stable subject id (`demo:…` for the simulated Google profile); null when Google was never used. */
  googleSub: string | null;
  createdAt: number;
  lastSignInAt: number | null;
}

export interface AuthSession {
  accountId: string;
  method: AuthMethod;
  startedAt: number;
  expiresAt: number;
}

/** The profile read from a verified Google ID token (or the simulated one). */
export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

/** Every code has a message under `auth.errors.<code>` in the catalogs. */
export const AUTH_ERROR_CODES = [
  'invalidCredentials',
  'locked',
  'rateLimited',
  'usernameTaken',
  'emailTaken',
  'otpInvalid',
  'otpExpired',
  'otpLocked',
  'otpRequired',
  'weakPassword',
  'cryptoUnavailable',
  'googleToken',
  'googleAudience',
  'googleExpired',
  'googleUnverified',
  'generic',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export interface AuthErrorDetail {
  /** For `locked` and `rateLimited`: how long until the visitor may try again. */
  retryAfterMs?: number;
  /** For `otpInvalid`: how many wrong codes are still allowed. */
  attemptsLeft?: number;
}

/** A failure the UI can explain; `code` selects the translated message. */
export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly detail: AuthErrorDetail;

  constructor(code: AuthErrorCode, detail: AuthErrorDetail = {}) {
    super(code);
    this.name = 'AuthError';
    this.code = code;
    this.detail = detail;
  }
}
