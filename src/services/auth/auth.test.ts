import { afterEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/i18n';
import { AUTH_ERROR_CODES, AuthError } from './types';
import { findAccount, initialOf, isValidEmail, isValidUsername, normaliseEmail, uniqueUsername, usernameFromEmail, usernameTaken } from './accounts';
import { checkCode, constantTimeEqual, generateCode, normaliseCode, OTP_MAX_ATTEMPTS, OTP_TTL_MS, randomHex, type OtpChallenge } from './otp';
import { checkPassword, cryptoAvailable, hashPassword, passwordStrength, timingSafeEqual, verifyPassword } from './password';
import { parseGoogleCredential } from './google';
import { loginFor, safeNext } from '@/lib/paths';
import { parseGoogleClientId } from '@/config/env';

afterEach(() => vi.useRealTimers());

describe('password hashing', () => {
  it('has Web Crypto in the test environment', () => {
    expect(cryptoAvailable()).toBe(true);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('Correct-Horse-9');
    expect(await verifyPassword('Correct-Horse-9', hash)).toBe(true);
    expect(await verifyPassword('correct-horse-9', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('stores scheme, cost, salt and hash — never the password — and salts every hash differently', async () => {
    const a = await hashPassword('Same-Password-1');
    const b = await hashPassword('Same-Password-1');
    expect(a).toMatch(/^pbkdf2-sha512\$1000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(a).not.toContain('Same-Password-1');
    expect(a).not.toBe(b);
    expect(await verifyPassword('Same-Password-1', b)).toBe(true);
  });

  it('honours the cost stored in the hash, so a later change of cost does not break old accounts', async () => {
    const old = await hashPassword('Old-Account-1', 500);
    expect(old.split('$')[1]).toBe('500');
    expect(await verifyPassword('Old-Account-1', old)).toBe(true);
  });

  it('never verifies a missing, foreign or corrupted record', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', 'plaintext')).toBe(false);
    expect(await verifyPassword('anything', 'bcrypt$10$abc$def')).toBe(false);
    expect(await verifyPassword('anything', 'pbkdf2-sha512$0$abc$def')).toBe(false);
    expect(await verifyPassword('anything', 'pbkdf2-sha512$1000$%%%$%%%')).toBe(false);
  });

  it('compares byte strings without stopping at the first difference', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
  });
});

describe('password policy', () => {
  it('needs 8–128 characters, a letter and a number', () => {
    expect(checkPassword('abc123').length).toBe(false);
    expect(checkPassword('abcdefgh').mixed).toBe(false);
    expect(checkPassword('12345678').mixed).toBe(false);
    expect(checkPassword('x'.repeat(129) + '1').length).toBe(false);
    expect(checkPassword('Correct-Horse-9').ok).toBe(true);
    expect(checkPassword('รหัสผ่านลับ99').ok).toBe(true); // letters of any script count
  });

  it('refuses common passwords, a repeated character and simple runs', () => {
    for (const bad of ['password1', 'Password123', 'qwerty123', 'aaaaaaaa1'.replace('1', 'a'), '12345678', 'abcdefgh', 'ChainBeat1']) {
      expect(checkPassword(bad).notCommon, bad).toBe(false);
    }
    expect(checkPassword('Tr0ub4dor&3').notCommon).toBe(true);
  });

  it('refuses a password that contains the username or the start of the email', () => {
    expect(checkPassword('alexander2024!', { username: 'Alexander' }).notPersonal).toBe(false);
    expect(checkPassword('mypass-jane.doe-1', { email: 'jane.doe@example.com' }).notPersonal).toBe(false);
    expect(checkPassword('Tr0ub4dor&3', { username: 'alexander', email: 'a@b.co' }).notPersonal).toBe(true);
    expect(checkPassword('Anything99a', { username: 'al' }).notPersonal).toBe(true); // too short to be meaningful
  });

  it('rates strength from 0 (too short) to 4', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc1')).toBe(0);
    expect(passwordStrength('password1')).toBe(1);
    expect(passwordStrength('kitchen7')).toBe(1);
    expect(passwordStrength('Kitchen7!')).toBe(2);
    expect(passwordStrength('kitchen-table-7')).toBeGreaterThanOrEqual(2);
    expect(passwordStrength('Kitchen-Table-Lamp-7!')).toBe(4);
    expect(passwordStrength('x'.repeat(20))).toBe(1);
  });
});

describe('one-time codes', () => {
  it('are six digits, leading zeros allowed', () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
    expect(generateCode(6, (b) => b.fill(0))).toBe('000000');
  });

  it('use every digit equally: bytes of 250 and above are discarded instead of wrapping onto 0–5', () => {
    const bytes = [255, 254, 250, 249, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    let at = 0;
    const fill = (b: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> => {
      for (let i = 0; i < b.length; i++) b[i] = bytes[at++ % bytes.length]!;
      return b;
    };
    // 249 → 9, 9 → 9, 10 → 0, 0 → 0, 1 → 1, 2 → 2 (255, 254, 250 skipped)
    expect(generateCode(6, fill)).toBe('990012');
  });

  it('random hex has the requested length', () => {
    expect(randomHex(16)).toMatch(/^[0-9a-f]{32}$/);
    expect(randomHex(16)).not.toBe(randomHex(16));
  });

  it('accepts a code pasted with spaces or dashes', () => {
    expect(normaliseCode('483 920')).toBe('483920');
    expect(normaliseCode('483-920\n')).toBe('483920');
    expect(constantTimeEqual('483920', '483920')).toBe(true);
    expect(constantTimeEqual('483920', '483921')).toBe(false);
    expect(constantTimeEqual('483920', '48392')).toBe(false);
  });

  const challenge = (over: Partial<OtpChallenge> = {}): OtpChallenge => ({
    id: 'otp-1',
    purpose: 'register',
    target: 'a@example.com',
    key: 'register|a@example.com',
    code: '123456',
    createdAt: 1_000,
    expiresAt: 1_000 + OTP_TTL_MS,
    attempts: 0,
    verifiedAt: null,
    consumed: false,
    ...over,
  });

  it('verifies the right code (also when typed with a space)', () => {
    const { next, result } = checkCode(challenge(), '123 456', 2_000);
    expect(result).toEqual({ ok: true });
    expect(next.verifiedAt).toBe(2_000);
  });

  it('counts wrong guesses and locks the code after five — even for the right code afterwards', () => {
    let c = challenge();
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) {
      const step = checkCode(c, '000000', 2_000);
      expect(step.result).toEqual({ ok: false, reason: 'invalid', attemptsLeft: OTP_MAX_ATTEMPTS - i });
      c = step.next;
    }
    const last = checkCode(c, '000000', 2_000);
    expect(last.result).toEqual({ ok: false, reason: 'locked', attemptsLeft: 0 });
    expect(checkCode(last.next, '123456', 2_000).result).toEqual({ ok: false, reason: 'locked', attemptsLeft: 0 });
  });

  it('expires after five minutes', () => {
    expect(checkCode(challenge(), '123456', 1_000 + OTP_TTL_MS).result.ok).toBe(true);
    expect(checkCode(challenge(), '123456', 1_000 + OTP_TTL_MS + 1).result).toEqual({ ok: false, reason: 'expired', attemptsLeft: 0 });
  });

  it('never verifies a decoy (a request for an account that does not exist)', () => {
    expect(checkCode(challenge({ code: '' }), '', 2_000).result.ok).toBe(false);
    expect(checkCode(challenge({ code: '' }), '000000', 2_000).result).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('cannot be used again once consumed', () => {
    expect(checkCode(challenge({ consumed: true, verifiedAt: 1_500 }), '123456', 2_000).result.ok).toBe(false);
  });
});

describe('account helpers', () => {
  const accounts = [
    { id: '1', username: 'Alex.Doe', email: 'alex@example.com', passwordHash: null, googleSub: null, createdAt: 0, lastSignInAt: null },
    { id: '2', username: 'sam', email: 'sam@example.com', passwordHash: null, googleSub: null, createdAt: 0, lastSignInAt: null },
  ];

  it('validates usernames and emails', () => {
    for (const ok of ['abc', 'A1_b-c.d', 'a'.repeat(24)]) expect(isValidUsername(ok), ok).toBe(true);
    for (const bad of ['ab', 'a'.repeat(25), '.abc', 'a b', 'ab@c', '_abc', 'ชื่อ']) expect(isValidUsername(bad), bad).toBe(false);
    for (const ok of ['a@b.co', 'first.last+tag@sub.example.org']) expect(isValidEmail(ok), ok).toBe(true);
    for (const bad of ['', 'a@b', 'a b@c.com', '@b.com', 'a@@b.com', 'a@b.c']) expect(isValidEmail(bad), bad).toBe(false);
    expect(normaliseEmail('  Alex@Example.COM ')).toBe('alex@example.com');
  });

  it('finds an account by username (any case) or by email', () => {
    expect(findAccount(accounts, 'alex.doe')?.id).toBe('1');
    expect(findAccount(accounts, ' ALEX.DOE ')?.id).toBe('1');
    expect(findAccount(accounts, 'Sam@Example.com')?.id).toBe('2');
    expect(findAccount(accounts, 'sam@elsewhere.com')).toBeUndefined();
    expect(findAccount(accounts, '')).toBeUndefined();
    expect(usernameTaken(accounts, 'ALEX.doe')).toBe(true);
  });

  it('derives a valid, unique username from an email address', () => {
    expect(usernameFromEmail('Jane.Doe+news@Example.com')).toBe('jane.doe_news');
    expect(isValidUsername(usernameFromEmail('x@y.com'))).toBe(true);
    expect(isValidUsername(usernameFromEmail('+++@y.com'))).toBe(true);
    expect(usernameFromEmail('a-very-long-address-that-goes-on-and-on@example.com').length).toBeLessThanOrEqual(20);
    expect(uniqueUsername(accounts, 'sam')).toBe('sam2');
    expect(uniqueUsername(accounts, 'fresh')).toBe('fresh');
    expect(initialOf(accounts[0]!)).toBe('A');
  });
});

/* ───────── Google ID tokens ───────── */

const b64url = (value: unknown): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const token = (claims: Record<string, unknown>): string => `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claims)}.${b64url('signature-is-not-checked')}`;

const CLIENT_ID = '123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com';
const NOW = 1_800_000_000_000;
const claims = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: '110169484474386276334',
  email: 'Alex.Example@Gmail.com',
  email_verified: true,
  name: 'Alex Example',
  nonce: 'n-1',
  exp: NOW / 1000 + 3600,
  ...over,
});
const expectation = { clientId: CLIENT_ID, nonce: 'n-1', now: NOW };
const failure = (credential: string): string | null => {
  try {
    parseGoogleCredential(credential, expectation);
    return null;
  } catch (e) {
    return e instanceof AuthError ? e.code : 'not-an-AuthError';
  }
};

describe('Google ID token claims', () => {
  it('reads the profile from a valid token (email lower-cased, name kept as is)', () => {
    expect(parseGoogleCredential(token(claims()), expectation)).toEqual({ sub: '110169484474386276334', email: 'alex.example@gmail.com', name: 'Alex Example' });
  });

  it('decodes UTF-8 names and falls back to the email name when there is none', () => {
    expect(parseGoogleCredential(token(claims({ name: 'สมชาย ใจดี' })), expectation).name).toBe('สมชาย ใจดี');
    expect(parseGoogleCredential(token(claims({ name: undefined })), expectation).name).toBe('Alex.Example');
  });

  it('accepts both spellings of the issuer', () => {
    expect(failure(token(claims({ iss: 'accounts.google.com' })))).toBeNull();
  });

  it('refuses a token for another app, another issuer or another page load', () => {
    expect(failure(token(claims({ aud: '999-other.apps.googleusercontent.com' })))).toBe('googleAudience');
    expect(failure(token(claims({ iss: 'https://evil.example' })))).toBe('googleToken');
    expect(failure(token(claims({ nonce: 'someone-elses' })))).toBe('googleToken');
    expect(failure(token(claims({ nonce: undefined })))).toBe('googleToken');
  });

  it('refuses an expired token (with a few minutes of clock skew allowed)', () => {
    expect(failure(token(claims({ exp: NOW / 1000 - 60 })))).toBeNull();
    expect(failure(token(claims({ exp: NOW / 1000 - 3600 })))).toBe('googleExpired');
    expect(failure(token(claims({ exp: 'soon' })))).toBe('googleExpired');
  });

  it('refuses an unverified or missing email, and a missing subject', () => {
    expect(failure(token(claims({ email_verified: false })))).toBe('googleUnverified');
    expect(failure(token(claims({ email_verified: 'true' })))).toBe('googleUnverified');
    expect(failure(token(claims({ email: undefined })))).toBe('googleToken');
    expect(failure(token(claims({ sub: '' })))).toBe('googleToken');
  });

  it('refuses anything that is not a three-part JWT with a JSON object inside', () => {
    expect(failure('')).toBe('googleToken');
    expect(failure('a.b')).toBe('googleToken');
    expect(failure('a.b.c.d')).toBe('googleToken');
    expect(failure(`x.${b64url('not json')}.y`)).toBe('googleToken');
    expect(failure(`x.${b64url('[1,2]')}.y`)).toBe('googleToken');
    expect(failure('x.%%%.y')).toBe('googleToken');
  });

  it('skips the nonce check only when none is expected', () => {
    expect(parseGoogleCredential(token(claims({ nonce: undefined })), { clientId: CLIENT_ID, now: NOW }).email).toBe('alex.example@gmail.com');
  });
});

describe('Google client ID', () => {
  it('accepts the documented shape and rejects everything else', () => {
    expect(parseGoogleClientId(CLIENT_ID)).toBe(CLIENT_ID);
    expect(parseGoogleClientId(`  ${CLIENT_ID}\n`)).toBe(CLIENT_ID);
    expect(parseGoogleClientId('not-a-client-id')).toBeNull();
    expect(parseGoogleClientId('GOCSPX-abcdefghijklmnopqrstuvwxyz1')).toBeNull();
    expect(parseGoogleClientId('123456789012-abc.apps.googleusercontent.com')).toBeNull();
    expect(parseGoogleClientId(`https://${CLIENT_ID}`)).toBeNull();
    expect(parseGoogleClientId(null)).toBeNull();
    expect(parseGoogleClientId(undefined)).toBeNull();
  });
});

describe('where to go after signing in', () => {
  it('accepts only a path inside this app', () => {
    expect(safeNext('/explorer/blocks')).toBe('/explorer/blocks');
    expect(safeNext('/governance/proposals/830?x=1#top')).toBe('/governance/proposals/830?x=1#top');
    expect(safeNext('/')).toBe('/');
  });

  it('refuses anything that could leave the site or loop back to a sign-in page', () => {
    for (const bad of [null, undefined, '', 'explorer', '//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/a\nb', '/a\u0000b', '/login', '/register?next=/', '/forgot-password', '/forgot-username#x', `/${'a'.repeat(400)}`]) {
      expect(safeNext(bad), String(bad)).toBeNull();
    }
  });

  it('builds the sign-in link for a protected page', () => {
    expect(loginFor('/account')).toBe('/login?next=%2Faccount');
    expect(safeNext(new URLSearchParams(loginFor('/account').split('?')[1]).get('next'))).toBe('/account');
  });
});

describe('error messages', () => {
  it('has a translation for every error code (including the plural ones)', () => {
    for (const code of AUTH_ERROR_CODES) expect(i18n.exists(`auth.errors.${code}`, { count: 2 }), code).toBe(true);
  });
});
