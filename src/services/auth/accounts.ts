import type { AuthAccount } from './types';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
/** Letters, digits, dot, underscore and hyphen; starts with a letter or digit. */
export const USERNAME_CHARS = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** Deliberately simple: one "@", no spaces, a dot in the domain. A mail server is the only real test of an address. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const EMAIL_MAX = 254;

export const normaliseEmail = (value: string): string => value.trim().toLowerCase();
export const normaliseIdentifier = (value: string): string => value.trim().toLowerCase();

export const isValidUsername = (value: string): boolean => value.length >= USERNAME_MIN && value.length <= USERNAME_MAX && USERNAME_CHARS.test(value);
export const isValidEmail = (value: string): boolean => value.length <= EMAIL_MAX && EMAIL_PATTERN.test(value);

export const usernameTaken = (accounts: readonly AuthAccount[], username: string): boolean => {
  const wanted = username.trim().toLowerCase();
  return accounts.some((a) => a.username.toLowerCase() === wanted);
};

export const emailTaken = (accounts: readonly AuthAccount[], email: string): boolean => {
  const wanted = normaliseEmail(email);
  return accounts.some((a) => a.email === wanted);
};

/** Finds an account by username or by email address (anything containing "@" is treated as an email). */
export function findAccount(accounts: readonly AuthAccount[], identifier: string): AuthAccount | undefined {
  const wanted = normaliseIdentifier(identifier);
  if (!wanted) return undefined;
  return wanted.includes('@') ? accounts.find((a) => a.email === wanted) : accounts.find((a) => a.username.toLowerCase() === wanted);
}

/** A valid, readable username derived from an email address ("Jane.Doe+news@x.org" → "jane.doe_news"). */
export function usernameFromEmail(email: string): string {
  const local = (email.split('@')[0] ?? '').toLowerCase().replace(/[^a-z0-9._-]/g, '_').replace(/^[^a-z0-9]+/, '');
  const base = local.slice(0, USERNAME_MAX - 4);
  return base.length >= USERNAME_MIN ? base : (base + 'user').slice(0, USERNAME_MAX - 4);
}

/** `base`, or `base2`, `base3`… until no account has it. */
export function uniqueUsername(accounts: readonly AuthAccount[], base: string): string {
  if (!usernameTaken(accounts, base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base.slice(0, USERNAME_MAX - String(n).length)}${n}`;
    if (!usernameTaken(accounts, candidate)) return candidate;
  }
}

/** Initial for the avatar circle. */
export const initialOf = (account: Pick<AuthAccount, 'username'>): string => (account.username.charAt(0) || '?').toUpperCase();
