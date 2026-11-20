import { useAuthStore } from '@/stores/authStore';
import { useOtpStore, type IssuedChallenge } from '@/stores/otpStore';
import { emailTaken, findAccount, normaliseEmail, normaliseIdentifier, usernameTaken } from './accounts';
import { AuthError, type AuthAccount } from './types';

/**
 * The three multi-step flows — register, reset a password, recover a username — as plain functions over the two stores.
 * Each flow is: request a code (`start…`), check it (`verifyCode`), then do the thing the code unlocks (`complete…`).
 *
 * Two privacy rules shape the "forgot" flows:
 *  - the answer to a request never depends on whether an account exists (an address that has no account gets a
 *    "no account" notice in the inbox instead of a code; an unknown username gets nothing), so the form cannot be used
 *    to find out who has an account;
 *  - a request for an unknown account still produces a challenge, but one that can never be verified.
 */

const otp = () => useOtpStore.getState();
const auth = () => useAuthStore.getState();

/** Step 1 of registration: the username and email must be free, then a code goes to the address. */
export function startRegistration(input: { username: string; email: string }): IssuedChallenge {
  const { accounts } = auth();
  if (usernameTaken(accounts, input.username)) throw new AuthError('usernameTaken');
  if (emailTaken(accounts, input.email)) throw new AuthError('emailTaken');
  return otp().request('register', normaliseEmail(input.email), 'code');
}

/** Step 1 of "forgot password": `identifier` is a username or an email address. */
export function startPasswordReset(identifier: string): IssuedChallenge {
  const account = findAccount(auth().accounts, identifier);
  if (account) return otp().request('reset-password', account.email, 'code');
  const typed = normaliseIdentifier(identifier);
  return otp().request('reset-password', typed, typed.includes('@') ? 'no-account' : 'none');
}

/** Step 1 of "forgot username". */
export function startUsernameRecovery(email: string): IssuedChallenge {
  const typed = normaliseEmail(email);
  const account = findAccount(auth().accounts, typed);
  return otp().request('recover-username', typed, account ? 'code' : 'no-account');
}

/** Requests another code for the same flow (the cooldown and per-address limit apply). */
export function resendCode(challenge: IssuedChallenge): IssuedChallenge {
  const { purpose, target } = challenge;
  const { accounts } = auth();
  if (purpose === 'register') return otp().request('register', target, 'code');
  const account = findAccount(accounts, target);
  if (account) return otp().request(purpose, target, 'code');
  return otp().request(purpose, target, target.includes('@') ? 'no-account' : 'none');
}

/** Checks what the visitor typed. Throws `otpInvalid` (with the attempts left), `otpExpired` or `otpLocked`. */
export function verifyCode(challengeId: string, code: string): void {
  const result = otp().verify(challengeId, code);
  if (result.ok) return;
  if (result.reason === 'invalid') throw new AuthError('otpInvalid', { attemptsLeft: result.attemptsLeft });
  throw new AuthError(result.reason === 'expired' ? 'otpExpired' : 'otpLocked');
}

/** Last step of registration: the code was verified, so create the account and sign in. */
export async function completeRegistration(input: { challengeId: string; username: string; email: string; password: string; remember?: boolean }): Promise<AuthAccount> {
  const challenge = otp().requireVerified(input.challengeId, 'register');
  if (challenge.target !== normaliseEmail(input.email)) throw new AuthError('otpRequired'); // the code was for another address
  const account = await auth().createAccount({ username: input.username, email: input.email, password: input.password, remember: input.remember });
  otp().markConsumed(input.challengeId);
  return account;
}

/** Last step of "forgot password": store the new password. Does not sign in. */
export async function completePasswordReset(input: { challengeId: string; newPassword: string }): Promise<void> {
  const challenge = otp().requireVerified(input.challengeId, 'reset-password');
  const account = findAccount(auth().accounts, challenge.target);
  if (!account) throw new AuthError('otpRequired'); // a decoy never verifies, so this only happens if the account was deleted meanwhile
  await auth().setPassword(account.id, input.newPassword);
  otp().markConsumed(input.challengeId);
}

/** Last step of "forgot username": the verified address owns the account, so show its username. */
export function revealUsername(challengeId: string): { username: string; email: string } {
  const challenge = otp().requireVerified(challengeId, 'recover-username');
  const account = findAccount(auth().accounts, challenge.target);
  if (!account) throw new AuthError('otpRequired');
  otp().markConsumed(challengeId);
  return { username: account.username, email: account.email };
}
