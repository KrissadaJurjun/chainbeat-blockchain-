import { afterEach, describe, expect, it, vi } from 'vitest';
import { OTP_MAX_ATTEMPTS, OTP_MAX_SENDS, OTP_RESEND_COOLDOWN_MS, OTP_SEND_WINDOW_MS, OTP_TTL_MS, OTP_VERIFIED_GRACE_MS } from '@/services/auth/otp';
import { AuthError } from '@/services/auth/types';
import * as flows from '@/services/auth/flows';
import { DEMO_GOOGLE_PROFILE, LOCKOUT_MS, MAX_FAILED_SIGN_INS, SESSION_TTL_MS, selectCurrentAccount, useAuthStore } from './authStore';
import { useOtpStore } from './otpStore';

const auth = () => useAuthStore.getState();
const otp = () => useOtpStore.getState();
const PASSWORD = 'Correct-Horse-9';

/** The code in the newest inbox message — what a person would read in their mail. */
const latestCode = (): string => otp().inbox[0]?.code ?? '';

async function register(username = 'alex', email = 'alex@example.com', password = PASSWORD) {
  const challenge = flows.startRegistration({ username, email });
  flows.verifyCode(challenge.id, latestCode());
  return flows.completeRegistration({ challengeId: challenge.id, username, email, password });
}

const code = async (promise: Promise<unknown> | (() => unknown)): Promise<string | null> => {
  try {
    await (typeof promise === 'function' ? promise() : promise);
    return null;
  } catch (e) {
    return e instanceof AuthError ? e.code : `not an AuthError: ${String(e)}`;
  }
};

afterEach(() => vi.useRealTimers());

describe('registration', () => {
  it('sends a code to the inbox, then creates the account and signs in', async () => {
    const challenge = flows.startRegistration({ username: 'Alex', email: ' Alex@Example.com ' });
    expect(otp().inbox).toHaveLength(1);
    expect(otp().inbox[0]).toMatchObject({ kind: 'code', purpose: 'register', to: 'alex@example.com', validForMinutes: 5 });
    expect(latestCode()).toMatch(/^\d{6}$/);
    expect(challenge.expiresAt - Date.now()).toBeGreaterThan(OTP_TTL_MS - 2_000);

    flows.verifyCode(challenge.id, latestCode());
    const account = await flows.completeRegistration({ challengeId: challenge.id, username: 'Alex', email: 'alex@example.com', password: PASSWORD });

    expect(account).toMatchObject({ username: 'Alex', email: 'alex@example.com', googleSub: null });
    expect(account.passwordHash).toMatch(/^pbkdf2-sha512\$/);
    expect(selectCurrentAccount(auth())?.id).toBe(account.id);
    expect(auth().session?.method).toBe('password');
  });

  it('will not create the account before the code is verified, or with a code for another address', async () => {
    const challenge = flows.startRegistration({ username: 'alex', email: 'alex@example.com' });
    expect(await code(flows.completeRegistration({ challengeId: challenge.id, username: 'alex', email: 'alex@example.com', password: PASSWORD }))).toBe('otpRequired');

    flows.verifyCode(challenge.id, latestCode());
    expect(await code(flows.completeRegistration({ challengeId: challenge.id, username: 'alex', email: 'someone.else@example.com', password: PASSWORD }))).toBe('otpRequired');
    expect(auth().accounts).toHaveLength(0);
  });

  it('uses a code once', async () => {
    const challenge = flows.startRegistration({ username: 'alex', email: 'alex@example.com' });
    flows.verifyCode(challenge.id, latestCode());
    await flows.completeRegistration({ challengeId: challenge.id, username: 'alex', email: 'alex@example.com', password: PASSWORD });
    auth().deleteAccount();
    expect(await code(flows.completeRegistration({ challengeId: challenge.id, username: 'alex', email: 'alex@example.com', password: PASSWORD }))).toBe('otpRequired');
  });

  it('rejects a taken username or email (any case) before a code is sent', async () => {
    await register();
    const before = otp().inbox.length;
    expect(await code(() => flows.startRegistration({ username: 'ALEX', email: 'other@example.com' }))).toBe('usernameTaken');
    expect(await code(() => flows.startRegistration({ username: 'other', email: 'Alex@Example.com' }))).toBe('emailTaken');
    expect(otp().inbox).toHaveLength(before);
  });

  it('enforces the password policy in the store too, not only in the form', async () => {
    const challenge = flows.startRegistration({ username: 'alex', email: 'alex@example.com' });
    flows.verifyCode(challenge.id, latestCode());
    for (const weak of ['short1', 'password123', 'alexalexalex1', 'onlyletters']) {
      expect(await code(flows.completeRegistration({ challengeId: challenge.id, username: 'alex', email: 'alex@example.com', password: weak })), weak).toBe('weakPassword');
    }
    expect(auth().accounts).toHaveLength(0);
  });

  it('stores only a salted hash: the plain password and the code never reach localStorage', async () => {
    const account = await register();
    const raw = window.localStorage.getItem('chainbeat.auth') ?? '';
    expect(raw).toContain(account.passwordHash);
    expect(raw).not.toContain(PASSWORD);
    expect(raw).not.toContain(latestCode() || 'no-code');
    expect(window.localStorage.getItem('chainbeat.otp')).toBeNull();
    const stored = JSON.parse(raw).state;
    expect(Object.keys(stored).sort()).toEqual(['accounts', 'googleClientId', 'session', 'throttle']);
  });
});

describe('signing in', () => {
  it('works with the username or the email, in any case, and starts a 12-hour session', async () => {
    await register('Alex', 'alex@example.com');
    auth().signOut();
    expect(selectCurrentAccount(auth())).toBeNull();

    for (const identifier of ['alex', 'ALEX', ' alex@example.com ', 'Alex@Example.com']) {
      auth().signOut();
      const account = await auth().signIn({ identifier, password: PASSWORD });
      expect(account.username).toBe('Alex');
      expect(selectCurrentAccount(auth())?.id).toBe(account.id);
    }
    const session = auth().session!;
    expect(session.expiresAt - session.startedAt).toBe(SESSION_TTL_MS.short);
  });

  it('remembers the visitor for 30 days when asked', async () => {
    await register();
    await auth().signIn({ identifier: 'alex', password: PASSWORD, remember: true });
    expect(auth().session!.expiresAt - auth().session!.startedAt).toBe(SESSION_TTL_MS.remember);
  });

  it('gives the same answer for a wrong password and for an unknown account', async () => {
    await register();
    expect(await code(auth().signIn({ identifier: 'alex', password: 'Wrong-Password-1' }))).toBe('invalidCredentials');
    expect(await code(auth().signIn({ identifier: 'nobody', password: PASSWORD }))).toBe('invalidCredentials');
    expect(await code(auth().signIn({ identifier: 'nobody@example.com', password: PASSWORD }))).toBe('invalidCredentials');
  });

  it('locks an identifier for a minute after five failures — even for the right password — then lets it in', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
    await register();
    auth().signOut();

    for (let i = 1; i < MAX_FAILED_SIGN_INS; i++) expect(await code(auth().signIn({ identifier: 'alex', password: 'nope-nope-1' }))).toBe('invalidCredentials');
    let lock: unknown;
    try {
      await auth().signIn({ identifier: 'alex', password: 'nope-nope-1' });
    } catch (e) {
      lock = e;
    }
    expect(lock).toBeInstanceOf(AuthError);
    expect((lock as AuthError).code).toBe('locked');
    expect((lock as AuthError).detail.retryAfterMs).toBe(LOCKOUT_MS);

    expect(await code(auth().signIn({ identifier: 'alex', password: PASSWORD }))).toBe('locked');
    vi.setSystemTime(Date.now() + LOCKOUT_MS - 1_000);
    expect(await code(auth().signIn({ identifier: 'alex', password: PASSWORD }))).toBe('locked');

    vi.setSystemTime(Date.now() + 2_000);
    expect(await code(auth().signIn({ identifier: 'alex', password: PASSWORD }))).toBeNull();
    expect(auth().throttle).toEqual({});
  });

  it('counts failures per identifier and forgets them after a successful sign-in', async () => {
    await register();
    for (let i = 0; i < 3; i++) await code(auth().signIn({ identifier: 'alex', password: 'nope-nope-1' }));
    expect(auth().throttle.alex?.fails).toBe(3);
    expect(auth().throttle['alex@example.com']).toBeUndefined();
    await auth().signIn({ identifier: 'alex', password: PASSWORD });
    expect(auth().throttle).toEqual({});
  });
});

describe('the session', () => {
  it('ends when it runs out, and signing out or deleting the account ends it too', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
    const account = await register();
    expect(selectCurrentAccount(auth())?.id).toBe(account.id);

    vi.setSystemTime(Date.now() + SESSION_TTL_MS.short + 1);
    expect(selectCurrentAccount(auth())).toBeNull();
    expect(auth().session).not.toBeNull();
    auth().purgeExpiredSession();
    expect(auth().session).toBeNull();

    await auth().signIn({ identifier: 'alex', password: PASSWORD });
    auth().signOut();
    expect(auth().session).toBeNull();
    expect(auth().accounts).toHaveLength(1);

    await auth().signIn({ identifier: 'alex', password: PASSWORD });
    auth().deleteAccount();
    expect(auth().accounts).toHaveLength(0);
    expect(auth().session).toBeNull();
  });

  it('is not an account that no longer exists', async () => {
    await register();
    useAuthStore.setState({ accounts: [] });
    expect(selectCurrentAccount(auth())).toBeNull();
  });

  it('follows a change made in another tab when the stored value is read again', async () => {
    const account = await register();
    const saved = window.localStorage.getItem('chainbeat.auth')!;
    auth().signOut();
    expect(auth().session).toBeNull();
    window.localStorage.setItem('chainbeat.auth', saved);
    await useAuthStore.persist.rehydrate();
    expect(selectCurrentAccount(auth())?.id).toBe(account.id);
  });
});

describe('forgot password', () => {
  it('resets the password with a code sent to the account email, found by username or email', async () => {
    await register('alex', 'alex@example.com');
    auth().signOut();
    for (const identifier of ['alex', 'alex@example.com']) {
      useOtpStore.getState().reset();
      const challenge = flows.startPasswordReset(identifier);
      expect(otp().inbox[0]).toMatchObject({ kind: 'code', purpose: 'reset-password', to: 'alex@example.com' });
      flows.verifyCode(challenge.id, latestCode());
      await flows.completePasswordReset({ challengeId: challenge.id, newPassword: `New-Password-${identifier.length}` });
      expect(await code(auth().signIn({ identifier: 'alex', password: `New-Password-${identifier.length}` }))).toBeNull();
      auth().signOut();
    }
    expect(await code(auth().signIn({ identifier: 'alex', password: PASSWORD }))).toBe('invalidCredentials');
  });

  it('applies the password policy to the new password and lifts a lock-out', async () => {
    await register();
    auth().signOut();
    for (let i = 0; i < MAX_FAILED_SIGN_INS; i++) await code(auth().signIn({ identifier: 'alex', password: 'nope-nope-1' }));
    expect(await code(auth().signIn({ identifier: 'alex', password: PASSWORD }))).toBe('locked');

    const challenge = flows.startPasswordReset('alex');
    flows.verifyCode(challenge.id, latestCode());
    expect(await code(flows.completePasswordReset({ challengeId: challenge.id, newPassword: 'alex12345' }))).toBe('weakPassword'); // contains the username
    await flows.completePasswordReset({ challengeId: challenge.id, newPassword: 'Brand-New-Pass-7' });
    expect(await code(auth().signIn({ identifier: 'alex', password: 'Brand-New-Pass-7' }))).toBeNull();
  });

  it('cannot be used without the code, with a wrong code, or twice', async () => {
    await register();
    const challenge = flows.startPasswordReset('alex');
    expect(await code(flows.completePasswordReset({ challengeId: challenge.id, newPassword: 'Brand-New-Pass-7' }))).toBe('otpRequired');
    expect(await code(() => flows.verifyCode(challenge.id, '000000' === latestCode() ? '111111' : '000000'))).toBe('otpInvalid');
    flows.verifyCode(challenge.id, latestCode());
    await flows.completePasswordReset({ challengeId: challenge.id, newPassword: 'Brand-New-Pass-7' });
    expect(await code(flows.completePasswordReset({ challengeId: challenge.id, newPassword: 'Another-Pass-8' }))).toBe('otpRequired');
  });

  it('does not reveal whether an account exists', async () => {
    await register();
    // an unknown email gets a "no account" notice instead of a code …
    const unknownEmail = flows.startPasswordReset('stranger@example.com');
    expect(otp().inbox[0]).toMatchObject({ kind: 'no-account', purpose: 'reset-password', to: 'stranger@example.com', code: null });
    // … an unknown username gets nothing at all …
    const before = otp().inbox.length;
    const unknownName = flows.startPasswordReset('stranger');
    expect(otp().inbox).toHaveLength(before);
    // … and in both cases the visitor is shown the same next step, which can never succeed
    for (const challenge of [unknownEmail, unknownName]) {
      expect(challenge).toMatchObject({ purpose: 'reset-password' });
      for (const guess of ['000000', '123456', '']) expect(await code(() => flows.verifyCode(challenge.id, guess))).not.toBeNull();
    }
    expect(auth().accounts).toHaveLength(1);
  });

  it('locks a code after five wrong guesses, even if the next guess is right', async () => {
    await register();
    const challenge = flows.startPasswordReset('alex');
    const right = latestCode();
    const wrong = right === '000000' ? '111111' : '000000';
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) expect(await code(() => flows.verifyCode(challenge.id, wrong))).toBe('otpInvalid');
    expect(await code(() => flows.verifyCode(challenge.id, wrong))).toBe('otpLocked');
    expect(await code(() => flows.verifyCode(challenge.id, right))).toBe('otpLocked');
  });

  it('reports how many guesses are left', () => {
    flows.startUsernameRecovery('nobody@example.com');
    const challenge = flows.startPasswordReset('nobody@example.com');
    try {
      flows.verifyCode(challenge.id, '000000');
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).detail.attemptsLeft).toBe(OTP_MAX_ATTEMPTS - 1);
    }
  });
});

describe('forgot username', () => {
  it('shows the username only after the emailed code is verified', async () => {
    await register('Alex.Doe', 'alex@example.com');
    auth().signOut();
    const challenge = flows.startUsernameRecovery(' ALEX@example.com ');
    expect(otp().inbox[0]).toMatchObject({ kind: 'code', purpose: 'recover-username', to: 'alex@example.com' });
    expect(() => flows.revealUsername(challenge.id)).toThrow(AuthError);
    flows.verifyCode(challenge.id, latestCode());
    expect(flows.revealUsername(challenge.id)).toEqual({ username: 'Alex.Doe', email: 'alex@example.com' });
    expect(() => flows.revealUsername(challenge.id)).toThrow(AuthError); // single use
  });

  it('answers an unknown email with a notice and a code that can never verify', async () => {
    const challenge = flows.startUsernameRecovery('stranger@example.com');
    expect(otp().inbox[0]).toMatchObject({ kind: 'no-account', code: null });
    expect(await code(() => flows.verifyCode(challenge.id, '123456'))).toBe('otpInvalid');
    expect(() => flows.revealUsername(challenge.id)).toThrow(AuthError);
  });

  it('does not accept a password-reset code for the username page, or the other way round', async () => {
    await register();
    const reset = flows.startPasswordReset('alex');
    flows.verifyCode(reset.id, latestCode());
    expect(() => flows.revealUsername(reset.id)).toThrow(AuthError);
  });
});

describe('one-time code delivery', () => {
  const at = (ms: number) => new Date(Date.UTC(2026, 10, 18, 10, 0, 0) + ms);

  it('makes the visitor wait 30 seconds before another code for the same address', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(0));
    const first = flows.startPasswordReset('nobody@example.com');
    expect(first.resendAt - Date.now()).toBe(OTP_RESEND_COOLDOWN_MS);
    vi.setSystemTime(at(OTP_RESEND_COOLDOWN_MS - 1_000));
    try {
      flows.resendCode(first);
      expect.unreachable('a second code inside the cooldown must be refused');
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).code).toBe('rateLimited');
      expect((e as AuthError).detail.retryAfterMs).toBe(1_000);
    }
    vi.setSystemTime(at(OTP_RESEND_COOLDOWN_MS));
    expect(flows.resendCode(first).id).not.toBe(first.id);
  });

  it('allows five codes per quarter of an hour for one address, then refuses until the oldest ages out', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    for (let i = 0; i < OTP_MAX_SENDS; i++) {
      vi.setSystemTime(at(i * OTP_RESEND_COOLDOWN_MS));
      flows.startPasswordReset('nobody@example.com');
    }
    vi.setSystemTime(at(OTP_MAX_SENDS * OTP_RESEND_COOLDOWN_MS));
    expect(() => flows.startPasswordReset('nobody@example.com')).toThrow(AuthError);
    // another address is not affected
    expect(() => flows.startPasswordReset('somebody@example.com')).not.toThrow();
    vi.setSystemTime(at(OTP_SEND_WINDOW_MS));
    expect(() => flows.startPasswordReset('nobody@example.com')).not.toThrow();
  });

  it('replaces the earlier code: only the newest one verifies', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(0));
    await register();
    auth().signOut();
    const first = flows.startPasswordReset('alex');
    const firstCode = latestCode();
    vi.setSystemTime(at(OTP_RESEND_COOLDOWN_MS));
    const second = flows.resendCode(first);
    expect(await code(() => flows.verifyCode(first.id, firstCode))).toBe('otpExpired');
    flows.verifyCode(second.id, latestCode());
    expect(otp().inbox).toHaveLength(3); // the registration code, then two reset codes
  });

  it('expires a code after five minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(0));
    await register();
    const challenge = flows.startPasswordReset('alex');
    vi.setSystemTime(at(OTP_TTL_MS + 1_000));
    expect(await code(() => flows.verifyCode(challenge.id, latestCode()))).toBe('otpExpired');
  });

  it('gives a verified code ten minutes for the step it unlocks', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(0));
    await register();
    auth().signOut();
    const challenge = flows.startPasswordReset('alex');
    flows.verifyCode(challenge.id, latestCode());
    vi.setSystemTime(at(OTP_VERIFIED_GRACE_MS + 1_000));
    expect(await code(flows.completePasswordReset({ challengeId: challenge.id, newPassword: 'Brand-New-Pass-7' }))).toBe('otpRequired');
  });

  it('keeps the inbox to twenty messages, newest first, and can clear it', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    for (let i = 0; i < 25; i++) {
      vi.setSystemTime(at(i * OTP_SEND_WINDOW_MS)); // far apart, so no rate limit applies
      flows.startPasswordReset(`person${i}@example.com`);
    }
    expect(otp().inbox).toHaveLength(20);
    expect(otp().inbox[0]!.to).toBe('person24@example.com');
    otp().clearInbox();
    expect(otp().inbox).toHaveLength(0);
  });

  it('never writes codes or the inbox to storage (they live in memory only)', async () => {
    await register();
    auth().signOut();
    flows.startPasswordReset('alex');
    expect(latestCode()).toMatch(/^\d{6}$/);
    expect(Object.keys(window.localStorage).filter((key) => /otp|code|inbox|mail/i.test(key))).toEqual([]);
    expect(Object.keys(window.sessionStorage)).toEqual([]);
  });
});

describe('Google sign-in', () => {
  const profile = { sub: '110169484474386276334', email: 'alex.example@gmail.com', name: 'Alex Example' };

  it('creates an account from the profile (no password) and signs in with it', () => {
    const account = auth().signInWithGoogle(profile, 'google');
    expect(account).toMatchObject({ username: 'alex.example', email: 'alex.example@gmail.com', passwordHash: null, googleSub: profile.sub });
    expect(auth().session?.method).toBe('google');
    // the second time it is the same account
    auth().signOut();
    expect(auth().signInWithGoogle(profile, 'google').id).toBe(account.id);
    expect(auth().accounts).toHaveLength(1);
  });

  it('opens an existing account that has the same (Google-verified) email, and links it', async () => {
    const existing = await register('alex', 'alex.example@gmail.com');
    auth().signOut();
    const account = auth().signInWithGoogle(profile, 'google');
    expect(account.id).toBe(existing.id);
    expect(account.googleSub).toBe(profile.sub);
    expect(account.passwordHash).toBe(existing.passwordHash); // the password still works
  });

  it('does not hand an address that belongs to one Google identity to another', () => {
    auth().signInWithGoogle(profile, 'google');
    auth().signOut();
    expect(() => auth().signInWithGoogle({ ...profile, sub: 'someone-else' }, 'google')).toThrow(AuthError);
  });

  it('picks a free username when the natural one is taken', async () => {
    await register('alex.example', 'other@example.com');
    expect(auth().signInWithGoogle(profile, 'google').username).toBe('alex.example2');
  });

  it('the simulation never opens an account that has a password, whatever its email says', async () => {
    const existing = await register('demo', DEMO_GOOGLE_PROFILE.email);
    auth().signOut();
    const account = auth().signInWithGoogle(DEMO_GOOGLE_PROFILE, 'google-demo');
    expect(account.id).not.toBe(existing.id);
    expect(account.email).toBe('demo.user+demo@example.com');
    expect(auth().session?.method).toBe('google-demo');
    expect(auth().accounts.find((a) => a.id === existing.id)?.googleSub).toBeNull();
  });

  it('keeps a Google-only account out of password sign-in', async () => {
    auth().signInWithGoogle(profile, 'google');
    auth().signOut();
    expect(await code(auth().signIn({ identifier: 'alex.example', password: 'Any-Password-1' }))).toBe('invalidCredentials');
  });

  it('can set a password later through "forgot password"', async () => {
    auth().signInWithGoogle(profile, 'google');
    auth().signOut();
    const challenge = flows.startPasswordReset('alex.example@gmail.com');
    flows.verifyCode(challenge.id, latestCode());
    await flows.completePasswordReset({ challengeId: challenge.id, newPassword: 'Brand-New-Pass-7' });
    expect(await code(auth().signIn({ identifier: 'alex.example', password: 'Brand-New-Pass-7' }))).toBeNull();
  });

  it('remembers a pasted client ID in this browser only', () => {
    auth().setGoogleClientId('123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com');
    expect(JSON.parse(window.localStorage.getItem('chainbeat.auth')!).state.googleClientId).toContain('.apps.googleusercontent.com');
    auth().setGoogleClientId(null);
    expect(auth().googleClientId).toBeNull();
  });
});
