import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DAY_MS, HOUR_MS, uid } from '@/lib/utils';
import { safeStorage } from '@/lib/storage';
import {
  emailTaken,
  findAccount,
  isValidEmail,
  isValidUsername,
  normaliseEmail,
  normaliseIdentifier,
  uniqueUsername,
  usernameFromEmail,
  usernameTaken,
} from '@/services/auth/accounts';
import { checkPassword, hashPassword, verifyPassword } from '@/services/auth/password';
import { AuthError, type AuthAccount, type AuthMethod, type AuthSession, type GoogleProfile } from '@/services/auth/types';

/**
 * Demo accounts and the current sign-in, kept in this browser's localStorage under `chainbeat.auth`.
 *
 * What is stored: usernames, email addresses, salted password hashes, the current session, failed-sign-in counters and
 * (optionally) a Google client ID — a public identifier. Never a plain password, a one-time code or a Google token.
 * There is no server: anyone who can run script on this page, or edit this browser's storage, can change these records.
 */

/** A session lasts 12 hours, or 30 days when the visitor asked to be remembered. */
export const SESSION_TTL_MS = { short: 12 * HOUR_MS, remember: 30 * DAY_MS } as const;
/** Failed sign-ins for one identifier before it is locked… */
export const MAX_FAILED_SIGN_INS = 5;
/** …and for how long. */
export const LOCKOUT_MS = 60_000;
/** The profile used by the clearly-labelled simulated Google sign-in. `example.com` is reserved for documentation. */
export const DEMO_GOOGLE_PROFILE: GoogleProfile = { sub: 'demo:google-user', email: 'demo.user@example.com', name: 'Demo Google user' };

interface Throttle {
  fails: number;
  lockedUntil: number;
}

interface AuthState {
  accounts: AuthAccount[];
  session: AuthSession | null;
  /** A Google client ID the visitor pasted (the build-time `VITE_GOOGLE_CLIENT_ID` takes precedence). */
  googleClientId: string | null;
  /** Failed sign-ins per lower-cased identifier. */
  throttle: Record<string, Throttle>;

  /** Creates an account and signs it in. The caller has already verified the email address with a one-time code. */
  createAccount: (input: { username: string; email: string; password: string; remember?: boolean }) => Promise<AuthAccount>;
  signIn: (input: { identifier: string; password: string; remember?: boolean }) => Promise<AuthAccount>;
  /** Opens (or creates) the account for a Google profile. `google-demo` never touches an account that has a password. */
  signInWithGoogle: (profile: GoogleProfile, method: Extract<AuthMethod, 'google' | 'google-demo'>, remember?: boolean) => AuthAccount;
  setPassword: (accountId: string, newPassword: string) => Promise<void>;
  signOut: () => void;
  /** Removes the signed-in account and ends the session. */
  deleteAccount: () => void;
  setGoogleClientId: (clientId: string | null) => void;
  /** Ends the session when it has run out. */
  purgeExpiredSession: (now?: number) => void;
}

function startSession(accountId: string, method: AuthMethod, remember: boolean, now: number): AuthSession {
  return { accountId, method, startedAt: now, expiresAt: now + (remember ? SESSION_TTL_MS.remember : SESSION_TTL_MS.short) };
}

/** Drops counters that no longer matter, so mistyped identifiers cannot make the stored record grow without bound. */
function pruneThrottle(throttle: Record<string, Throttle>, now: number): Record<string, Throttle> {
  return Object.fromEntries(Object.entries(throttle).filter(([, t]) => t.fails > 0 || t.lockedUntil > now));
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      /** Replaces one account (by id) in the list. */
      const update = (accounts: AuthAccount[], next: AuthAccount): AuthAccount[] => accounts.map((a) => (a.id === next.id ? next : a));

      return {
        accounts: [],
        session: null,
        googleClientId: null,
        throttle: {},

        createAccount: async ({ username, email, password, remember = false }) => {
          const name = username.trim();
          const address = normaliseEmail(email);
          if (!isValidUsername(name) || !isValidEmail(address)) throw new AuthError('generic');
          if (usernameTaken(get().accounts, name)) throw new AuthError('usernameTaken');
          if (emailTaken(get().accounts, address)) throw new AuthError('emailTaken');
          if (!checkPassword(password, { username: name, email: address }).ok) throw new AuthError('weakPassword');
          const passwordHash = await hashPassword(password);

          // the hash took a moment: look again, another tab may have registered the same name meanwhile
          if (usernameTaken(get().accounts, name)) throw new AuthError('usernameTaken');
          if (emailTaken(get().accounts, address)) throw new AuthError('emailTaken');
          const now = Date.now();
          const account: AuthAccount = { id: uid('acct'), username: name, email: address, passwordHash, googleSub: null, createdAt: now, lastSignInAt: now };
          set((s) => ({ accounts: [...s.accounts, account], session: startSession(account.id, 'password', remember, now) }));
          return account;
        },

        signIn: async ({ identifier, password, remember = false }) => {
          const key = normaliseIdentifier(identifier);
          const lock = get().throttle[key];
          const before = Date.now();
          if (lock && lock.lockedUntil > before) throw new AuthError('locked', { retryAfterMs: lock.lockedUntil - before });

          const account = findAccount(get().accounts, identifier);
          const ok = await verifyPassword(password, account?.passwordHash ?? null);
          const now = Date.now();
          if (!account || !ok) {
            const fails = (get().throttle[key]?.fails ?? 0) + 1;
            const locked = fails >= MAX_FAILED_SIGN_INS;
            set((s) => ({ throttle: pruneThrottle({ ...s.throttle, [key]: { fails: locked ? 0 : fails, lockedUntil: locked ? now + LOCKOUT_MS : 0 } }, now) }));
            throw locked ? new AuthError('locked', { retryAfterMs: LOCKOUT_MS }) : new AuthError('invalidCredentials');
          }

          const signedIn: AuthAccount = { ...account, lastSignInAt: now };
          set((s) => {
            const { [key]: _cleared, ...throttle } = s.throttle;
            return { accounts: update(s.accounts, signedIn), session: startSession(account.id, 'password', remember, now), throttle };
          });
          return signedIn;
        },

        signInWithGoogle: (profile, method, remember = false) => {
          const now = Date.now();
          const { accounts } = get();
          const email = normaliseEmail(profile.email);
          let account = accounts.find((a) => a.googleSub === profile.sub);
          // A real Google profile may open an existing account that uses the same (Google-verified) email address.
          // The simulated profile must not: it carries no proof of anything.
          if (!account && method === 'google') {
            account = accounts.find((a) => a.email === email);
            // an address already tied to a different Google identity is not handed to this one
            if (account?.googleSub) throw new AuthError('emailTaken');
          }

          let next: AuthAccount;
          let list: AuthAccount[];
          if (account) {
            next = { ...account, googleSub: profile.sub, lastSignInAt: now };
            list = update(accounts, next);
          } else {
            const free = emailTaken(accounts, email) ? email.replace('@', `+${method === 'google' ? 'google' : 'demo'}@`) : email;
            next = {
              id: uid('acct'),
              username: uniqueUsername(accounts, usernameFromEmail(email)),
              email: free,
              passwordHash: null,
              googleSub: profile.sub,
              createdAt: now,
              lastSignInAt: now,
            };
            list = [...accounts, next];
          }
          set({ accounts: list, session: startSession(next.id, method, remember, now) });
          return next;
        },

        setPassword: async (accountId, newPassword) => {
          const account = get().accounts.find((a) => a.id === accountId);
          if (!account) throw new AuthError('generic');
          if (!checkPassword(newPassword, { username: account.username, email: account.email }).ok) throw new AuthError('weakPassword');
          const passwordHash = await hashPassword(newPassword);
          set((s) => {
            // a changed password also lifts a lock-out left over from failed attempts
            const throttle = { ...s.throttle };
            delete throttle[account.username.toLowerCase()];
            delete throttle[account.email];
            return { accounts: update(s.accounts, { ...account, passwordHash }), throttle };
          });
        },

        signOut: () => set({ session: null }),

        deleteAccount: () =>
          set((s) => ({ accounts: s.accounts.filter((a) => a.id !== s.session?.accountId), session: null })),

        setGoogleClientId: (googleClientId) => set({ googleClientId }),

        purgeExpiredSession: (now = Date.now()) => {
          const { session } = get();
          if (session && session.expiresAt <= now) set({ session: null });
        },
      };
    },
    {
      name: 'chainbeat.auth',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ accounts: s.accounts, session: s.session, googleClientId: s.googleClientId, throttle: s.throttle }),
    },
  ),
);

/** The signed-in account, or null (no session, an expired one, or an account that no longer exists). */
export function selectCurrentAccount(state: Pick<AuthState, 'accounts' | 'session'>, now = Date.now()): AuthAccount | null {
  const { session } = state;
  if (!session || session.expiresAt <= now) return null;
  return state.accounts.find((a) => a.id === session.accountId) ?? null;
}

export const useCurrentAccount = (): AuthAccount | null => useAuthStore((s) => selectCurrentAccount(s));
