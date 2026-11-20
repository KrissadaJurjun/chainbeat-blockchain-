/**
 * Build-time configuration (public Vite variables — everything here ends up in the browser bundle, so none of it
 * may be a secret). All values are optional; see .env.example.
 */
const clean = (value: string | undefined): string => (value ?? '').trim();

/** Only an https:// (or http://localhost) URL is accepted for links, so a mistyped variable cannot inject a `javascript:` link. */
function safeUrl(value: string | undefined): string | null {
  const v = clean(value);
  if (!v) return null;
  try {
    const u = new URL(v);
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    return u.protocol === 'https:' || (u.protocol === 'http:' && local) ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * A Google OAuth *client ID* looks like `1234567890-abcdefghijklmnop.apps.googleusercontent.com`. It is a public
 * identifier (it is visible in every page that uses Google sign-in), unlike the client *secret*, which must never be
 * placed in a front-end app and is rejected by `looksLikeClientSecret`.
 */
const GOOGLE_CLIENT_ID_PATTERN = /^\d{6,}-[a-z0-9_]{16,}\.apps\.googleusercontent\.com$/i;

/** The trimmed client ID when it has the right shape, otherwise `null`. */
export function parseGoogleClientId(value: string | null | undefined): string | null {
  const v = clean(value ?? undefined);
  return GOOGLE_CLIENT_ID_PATTERN.test(v) ? v : null;
}

/** Google's OAuth client secrets start with `GOCSPX-`. Pasting one into a browser app would publish it. */
export const looksLikeClientSecret = (value: string): boolean => /^GOCSPX-/i.test(value.trim());

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

/** Link shown in the footer when configured (e.g. the project's documentation site). */
export const DOCS_URL: string | null = safeUrl(import.meta.env.VITE_DOCS_URL);
/** Link shown in the footer when configured (the project's repository). No other social links exist. */
export const GITHUB_URL: string | null = safeUrl(import.meta.env.VITE_GITHUB_URL);
/** Cosmos REST (LCD) endpoint for the experimental Live provider. Without it only Demo Mode exists. */
export const LIVE_REST_URL: string | null = safeUrl(import.meta.env.VITE_COSMOS_REST_URL);
/**
 * Optional Google OAuth client ID that turns the simulated "Sign in with Google" button into the real one (Google
 * Identity Services). A public identifier, not a secret. Without it (and without one saved in the browser by the
 * visitor) the page never contacts Google.
 */
export const GOOGLE_CLIENT_ID: string | null = parseGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID);
