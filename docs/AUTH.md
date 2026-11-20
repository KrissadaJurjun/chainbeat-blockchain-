# Demo accounts: sign in, register, forgot username / password, one-time codes, Google

ChainBeat can be used without an account, and most visitors never need one. The pages described here are an
**optional demo of an account system**: a sign-in page, a register page, "forgot username" and "forgot password"
pages, one-time codes (OTP) and a "Sign in with Google" button. Read the next section before relying on any of it.

## What is real and what is not

| Piece | What it really is |
| --- | --- |
| Accounts | Records in this browser's `localStorage` (`chainbeat.auth`). **There is no server and no database.** An account made in one browser does not exist in another, and anyone who can run script on the page or edit the browser's storage can change it. |
| Passwords | Hashed in the browser with PBKDF2-HMAC-SHA512 (210 000 rounds, random 16-byte salt) and stored as `pbkdf2-sha512$rounds$salt$hash`. The plain password is never stored. This keeps a password out of a casual look at the storage; it does **not** make a browser-only store secure. The pages tell the visitor not to reuse a real password. |
| One-time codes | Generated and checked in the browser. **No email and no SMS is ever sent**: this build has no mail server or SMS gateway (a static site cannot send mail without a server and provider credentials). The "message" appears in an on-page **Demo inbox** instead, labelled as such. Codes live in memory only. |
| Google sign-in | **Real Google Identity Services** when the visitor (or the build) supplies a Google OAuth *client ID*. Until then the button is a clearly labelled **simulation** that never contacts Google. See [Google sign-in](#google-sign-in). |
| Sessions | A record in the same `localStorage` key: 12 hours, or 30 days with "Keep me signed in". |

So: the *flows* are complete and exercised (see [Tests](#tests)); the *delivery* of codes and the *trust* in an account
are simulated. Nothing signed in here unlocks anything — every other page of ChainBeat stays open to everyone.

## Pages

| Route | Page | Layout |
| --- | --- | --- |
| `/login` | Sign in with username or email + password, "Keep me signed in", links to the other pages, Google button | slim auth layout (language and theme pickers, no sidebar) |
| `/register` | Username, email, password (strength meter and checklist), then a code step, then the signed-in confirmation | auth layout + Demo inbox |
| `/forgot-username` | Email → code → shows the username | auth layout + Demo inbox |
| `/forgot-password` | Username or email → code → new password → done | auth layout + Demo inbox |
| `/account` | The signed-in account (username, email, how it signed in, dates), sign out, delete the demo account. A guest is sent to `/login?next=/account` | normal app shell |

The header's account menu offers **Sign in / Create account** to a guest and **My account / Sign out** to a signed-in
visitor; the command palette (Ctrl/⌘ K) finds the pages. `?next=/some/path` returns the visitor to a page of this app
after signing in; only a same-origin path is accepted (`//evil.example`, `https://…`, `/\…` and the sign-in pages
themselves are ignored — `safeNext` in `src/lib/paths.ts`).

## Flows

**Register.** (1) Username (3–24 letters, digits, `.` `_` `-`, unique ignoring case), email, password twice. Taken names
and addresses are reported before a code is "sent". (2) A 6-digit code goes to the Demo inbox; the visitor types it.
(3) The account is created, the visitor is signed in. The code is single-use and must be for the same address.

**Sign in.** Username or email (any case) + password. One generic message for "no such account" and "wrong password";
a dummy hash is computed for unknown accounts so both take about the same time. Five failures for one identifier lock
it for 60 seconds (even the right password is refused meanwhile); a successful sign-in clears the counter.

**Forgot password.** Username *or* email → a code to the account's email → the visitor sets a new password (the same
policy applies) → the old password stops working and any lock-out is lifted. **Forgot username.** Email → code → the
username is shown only after the code is verified.

**Not revealing who has an account.** The answer to a "forgot" request never depends on whether the account exists:
an unknown *email* gets a "no ChainBeat account uses this address" notice in the inbox instead of a code, an unknown
*username* gets nothing, and the visitor sees the same code screen either way — where nothing they type can succeed
(a "decoy" challenge). Registration is the exception: it says plainly that a username or address is taken, because
hiding that would only make the form unusable.

## One-time codes

- 6 random digits, uniformly distributed (rejection sampling over `crypto.getRandomValues`, so no digit is more likely).
- Valid for 5 minutes; 5 wrong guesses lock the code (even for the right digits afterwards); a new code replaces the
  earlier ones for the same purpose and address.
- At least 30 seconds between codes for one address, at most 5 per 15 minutes (the same for known and unknown accounts).
- A pasted code with spaces or dashes is accepted. A verified code unlocks the next step for 10 minutes, once.
- Compared in constant time; never written to storage; a page reload forgets every pending code (start again).

## Google sign-in

[Google Identity Services](https://developers.google.com/identity/gsi/web) (GIS) shows Google's own button; when the
visitor approves, Google calls back with an **ID token** (a signed JWT).

**What the app does with it** (`src/services/auth/google.ts`): checks `iss` (Google), `aud` (this client ID), `exp`
(with 5 minutes of clock skew), the `nonce` it gave GIS (so a token from another page load is refused) and that the
email is **verified**; then opens the local account with that Google subject — or, for a Google-verified email that
matches an existing account without a Google link, links and opens it — or creates a new account without a password.
Such an account can still set one through "forgot password".

**What it does not do:** it does **not verify the token's signature**. That needs Google's public keys and belongs on a
server; here the token only decides which *local demo account* to open. A real application must verify the signature,
`iss`, `aud` and `exp` on its server before creating a session.

**Making the button real** (only you can do this, because it needs your Google account):

1. In the [Google Cloud console](https://console.cloud.google.com/) create a project → *APIs & Services* → *Credentials*
   → *Create credentials* → *OAuth client ID* → application type **Web application** (you may be asked to configure
   the consent screen first).
2. Under **Authorized JavaScript origins** add the exact origin the site is opened from, for example
   `http://localhost:4173` **and** `http://localhost` (Google accepts `localhost`, not a bare `127.0.0.1`; open the site
   as `http://localhost:4173`). For a deployment, its `https://` origin. No redirect URI is needed for this button.
3. Copy the **client ID** (`1234567890-….apps.googleusercontent.com`) and either paste it into *Set up real Google
   sign-in* on `/login` (kept in this browser only) or build the site with `VITE_GOOGLE_CLIENT_ID=…`
   (see `.env.example`).

The client ID is a **public identifier**. Never use the client *secret* (`GOCSPX-…`): the form rejects anything shaped
like one, and the secret has no place in a browser app.

**Privacy.** With no client ID the app never contacts Google and loads no Google code (tested: the only origin the
sign-in pages request is their own). Once a client ID exists, Google's script is loaded from `accounts.google.com` on
`/login` and `/register`, so Google can see that the page was opened; the setup panel says so. The Docker/nginx
Content-Security-Policy allows exactly Google's documented GIS endpoints for this (see [SECURITY.md](SECURITY.md)).
A visitor's Google profile picture is deliberately not loaded or stored.

**Verified and not verified.** The claim checks and the whole sign-in flow are unit-tested and exercised end to end
against a **stub** of Google's script (same `google.accounts.id` shape). The real script was never run with a real
client ID and a real Google account in this project's test environment — that needs your credentials — so a first real
sign-in is the one thing to try yourself.

## What a real deployment would need

A static site cannot do this safely, so a production version needs a server: password hashing with argon2id/scrypt/
bcrypt and a server-side pepper or HSM; sessions in `HttpOnly`, `Secure`, `SameSite` cookies with CSRF protection;
codes generated, hashed, rate-limited and expired on the server and delivered by an email or SMS provider (SMTP, SES,
SendGrid, Twilio…) with proper bounce and abuse handling; per-IP and per-account throttling; Google token signature and
claim verification server-side; an account-recovery policy that does not rely on a single email; audit logging; data
export and deletion; ideally passkeys or an authenticator app instead of SMS codes. `src/services/auth/flows.ts` is
the seam: the pages call `startRegistration`, `verifyCode`, `completeRegistration` and friends and know nothing
about where accounts live.

## Storage

| Key | Holds |
| --- | --- |
| `chainbeat.auth` | accounts (username, email, salted password hash, Google subject, dates), the current session, failed-sign-in counters, and a pasted Google client ID |

Never stored: a plain password, a one-time code, the Demo inbox, a Google token, a profile picture. Settings → Privacy
lists the key, and "Clear all ChainBeat data in this browser" removes it. Storage access goes through
`lib/storage.ts`, so private windows and blocked storage degrade instead of crashing. A sign-in or sign-out in one tab
is picked up by the others (`storage` event).

## Where the code is

| Path | What |
| --- | --- |
| `src/services/auth/` | `types` (accounts, errors), `password` (hashing, policy, strength), `otp` (generation and checking rules), `accounts` (lookup and validation helpers), `google` (GIS loader, token claims), `flows` (the multi-step flows over the two stores) |
| `src/stores/authStore.ts`, `otpStore.ts` | persisted accounts and session; in-memory codes and the Demo inbox |
| `src/components/auth/` | `AuthLayout`, `AuthCard`, `PasswordField` (+ meter), `OtpStep`, `DemoInbox`, `GoogleSignIn` (+ setup guide), `useAuthSchemas` |
| `src/pages/` | `LoginPage`, `RegisterPage`, `ForgotUsernamePage`, `ForgotPasswordPage`, `MyAccountPage` |
| `src/i18n/locales/*/auth.json` | the `auth` namespace (60 languages; see [I18N.md](I18N.md) for how it was produced) |

## Tests

Unit (Vitest, `src/services/auth/auth.test.ts`, `src/stores/auth.test.ts`): hashing and verification, the password
policy, code generation and every rule above (with controllable clocks), the flows end to end including decoys,
lock-outs, expiry and single use, Google token claims, `?next=` handling, that nothing secret reaches storage.
Component (`src/pages/auth.test.tsx`): each page's flows through the real UI with `user-event`, the Google button
against a mocked loader, the account menu, the inbox, routing. End to end (`tests/e2e/auth.spec.ts`, Playwright on the
production build): the same flows in a real browser, code expiry with a fake clock, the stubbed Google script, "no
request leaves this origin", layout and direction in all 60 languages at 320 and 1280 px, axe-core audits (dark and
light).

**Not done:** a real sign-in through Google, any real email or SMS, other browsers, screen readers, a review of the
`auth` translations by native speakers, and a security review of any kind — treat this as a demonstration.
