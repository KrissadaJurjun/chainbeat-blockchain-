import { parseGoogleClientId } from '@/config/env';
import { randomHex } from './otp';
import { AuthError, type GoogleProfile } from './types';

/**
 * "Sign in with Google" through Google Identity Services (GIS).
 *
 * Only a public OAuth *client ID* is involved — never a secret. GIS shows its own button, and when the visitor
 * approves, Google calls back with an ID token (a signed JWT). Because this app has no server, the token's claims are
 * checked here (`iss`, `aud`, `exp`, `nonce`, verified email) but its **signature is not verified**: that needs
 * Google's public keys and belongs on a server. In a browser-only demo the token only decides which local demo
 * account to open (docs/AUTH.md).
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';

export interface GoogleButtonOptions {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill';
  logo_alignment?: 'left' | 'center';
  width?: number;
}

export interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    nonce?: string;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    itp_support?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

let loading: Promise<GoogleAccountsId> | null = null;

/** Adds Google's script to the page (once) and resolves with its `accounts.id` API. Rejects when it cannot be loaded. */
export function loadGoogleIdentity(timeoutMs = 12_000): Promise<GoogleAccountsId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  if (loading) return loading;
  loading = new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    const fail = (reason: string): void => {
      window.clearTimeout(timer);
      script.remove();
      loading = null; // allow a retry
      reject(new Error(reason));
    };
    const timer = window.setTimeout(() => fail('timeout'), timeoutMs);
    script.onload = () => {
      window.clearTimeout(timer);
      const api = window.google?.accounts?.id;
      if (api) resolve(api);
      else fail('missing');
    };
    script.onerror = () => fail('network');
    document.head.append(script);
  });
  return loading;
}

/* One initialisation per client ID and page load; the credential goes to whichever component is mounted. */
type CredentialHandler = (credential: string) => void;
let handler: CredentialHandler | null = null;
let initialisedFor: string | null = null;
/** Ties every token to this page load: a token obtained elsewhere (or earlier) carries a different nonce and is refused. */
export const pageNonce = randomHex(16);

export function setGoogleCredentialHandler(next: CredentialHandler | null): void {
  handler = next;
}

export function initialiseGoogle(api: GoogleAccountsId, clientId: string): void {
  if (initialisedFor === clientId) return;
  api.initialize({
    client_id: clientId,
    callback: (response) => handler?.(response.credential),
    nonce: pageNonce,
    auto_select: false,
    cancel_on_tap_outside: true,
    itp_support: true,
  });
  initialisedFor = clientId;
}

/* ───────────────────────── the token ───────────────────────── */

function decodeBase64Url(part: string): string {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
/** Clocks differ a little between Google and the visitor's device. */
const CLOCK_SKEW_MS = 5 * 60_000;

export interface CredentialExpectations {
  clientId: string;
  nonce?: string;
  now: number;
}

/**
 * Reads the profile out of a GIS ID token after checking its claims. Throws an {@link AuthError} when the token is
 * malformed, was issued for another client ID or page load, has expired, or carries an unverified email address.
 * The signature is NOT checked (see the file comment).
 */
export function parseGoogleCredential(credential: string, expect: CredentialExpectations): GoogleProfile {
  const parts = credential.split('.');
  if (parts.length !== 3) throw new AuthError('googleToken');
  let claims: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(parts[1] ?? ''));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
    claims = parsed as Record<string, unknown>;
  } catch {
    throw new AuthError('googleToken');
  }

  if (typeof claims.iss !== 'string' || !ISSUERS.has(claims.iss)) throw new AuthError('googleToken');
  if (claims.aud !== expect.clientId) throw new AuthError('googleAudience');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 + CLOCK_SKEW_MS < expect.now) throw new AuthError('googleExpired');
  if (expect.nonce !== undefined && claims.nonce !== expect.nonce) throw new AuthError('googleToken');
  if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string' || !claims.email) throw new AuthError('googleToken');
  if (claims.email_verified !== true) throw new AuthError('googleUnverified');

  const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : claims.email.split('@')[0] ?? claims.email;
  return { sub: claims.sub, email: claims.email.trim().toLowerCase(), name };
}

/** The shape check used by the "paste your client ID" form (the same pattern as the build-time variable). */
export { parseGoogleClientId };
