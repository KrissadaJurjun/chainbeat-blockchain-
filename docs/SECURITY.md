# Security and privacy notes

ChainBeat is a front-end-only demo. This document states what it does and does not do with secrets, wallets and
storage, so that nobody has to read the code to find out.

## Hard rules the code follows

- **No secrets, ever.** There are no API keys, private keys, seed phrases, mnemonics or tokens anywhere in the
  source, the tests or the build. The app never asks for a wallet password, seed phrase or private key and has no
  field that accepts one. The only credential it asks for is the password of the **optional demo account**
  ([AUTH.md](AUTH.md)), which is stored only as a salted hash in the visitor's own browser; the pages tell the visitor
  not to reuse a real password. `.env.example` lists only optional, non-secret settings; anything prefixed `VITE_` is
  compiled into the public bundle, so it must never hold a secret (a Google OAuth *client ID* is a public identifier;
  a client *secret* is rejected by the form and must never be used).
- **Nothing is signed or broadcast.** No code path creates, signs or submits a blockchain transaction. The Demo
  workflows (swap, stake, liquid staking, send, vote, create proposal) change a *local ledger* of fictional
  balances and say so ("simulated", "Demo") on the screen, in the success message and in the activity list.
- **No outbound network requests by default.** There are no third-party scripts, analytics, trackers or CDN links;
  fonts are bundled. The only things that reach outside the page are user-initiated hand-offs
  (`navigator.clipboard.writeText` for the Copy buttons, and the footer's Share action, which opens the browser's
  native share sheet with the app's own URL — or copies it where that is unavailable) and **two optional,
  explicit exceptions**:
  1. When (and only when) the site is built with `VITE_COSMOS_REST_URL`, Settings shows a **Test connection**
     button. Pressing it sends two read-only `GET` requests (`…/blocks/latest`, `…/node_info`) to that endpoint with
     no credentials and no cookies, shows the answer and stores nothing
     ([`liveClient.ts`](../src/services/chain/liveClient.ts): Zod-validated responses, 8 s timeout, client-side rate
     limit, https or localhost only).
  2. When (and only when) a Google OAuth client ID exists — built in with `VITE_GOOGLE_CLIENT_ID`, or pasted by the
     visitor on `/login` — the sign-in pages load Google's own script from `https://accounts.google.com/gsi/client`
     to show Google's button, so Google can see that the page was opened. Without a client ID the button is a
     labelled simulation and nothing is requested ([AUTH.md](AUTH.md#google-sign-in)).

  Without those the app never requests anything but its own files; you can verify this in the browser's network
  panel: the only requests are for the page itself and the route, locale and font chunks fetched on demand, all
  same-origin (an end-to-end test asserts this for the sign-in pages).
- **No invented chain facts presented as real.** All blocks, hashes, prices, validators and proposals are
  generated locally and labelled as simulated; addresses are syntactically valid bech32 but belong to no one.

## Wallets

| Adapter | Behaviour |
| --- | --- |
| Demo wallet | A constant, public seed string deterministically derives a valid-looking address for each chain. It is not a key pair, controls nothing, and is stored (address and fictional balances) in `localStorage['chainbeat.wallet']`. |
| Keplr / Leap | Read-only. When the extension is present, the adapter calls `enable(chainId)` and `getKey(chainId)` to read the **public** address and account name, nothing else. It never requests a signer, signs, or sends. The connection is held in memory only and is **not persisted**; after a reload the user reconnects. |

While a real wallet address is connected, the simulated workflows are gated (the user is told why and offered the
Demo wallet) so a real account can never be confused with the fictional ledger. Real balances are not read.

> The Keplr/Leap adapters follow the injected-API shape both extensions document, but they were **not exercised
> against the real extensions** in this project's test environment (see LIMITATIONS.md). Review them before
> relying on them.

## What is stored in the browser

Only `localStorage` under the `chainbeat.*` keys (Settings → Privacy lists them with what each one holds):

| Key | Holds |
| --- | --- |
| `chainbeat.lang` | the selected language code |
| `chainbeat.ui` | theme, reduced motion, compact layout, refresh preference, sidebar state, favourites |
| `chainbeat.chain` | the selected network id |
| `chainbeat.sim` | simulated clock anchor, speed and latency (forced errors are never persisted) |
| `chainbeat.wallet` | the Demo wallet: fictional balances, activity (with its synthetic transactions), votes, drafted proposals. A connected *real* wallet is never persisted |
| `chainbeat.notifications` | which notifications were read or dismissed, and the local event notifications (wallet connected, simulated transaction confirmed, network switched, …) |
| `chainbeat.search` | the last 8 searches |
| `chainbeat.auth` | the optional **demo accounts**: usernames, email addresses, salted PBKDF2 password hashes, the current sign-in session, failed-sign-in counters and a pasted Google client ID. Never a plain password, a one-time code or a Google token |

Nothing is sent anywhere. No seed phrase, private key or wallet password is ever requested, so none can be stored;
the one secret-like thing that is stored is the demo account's password *hash* (see [AUTH.md](AUTH.md) for what that
does and does not protect against — a browser-only store cannot be made secure). Storage access is wrapped so that
private windows or blocked storage degrade gracefully instead of crashing. "Reset demo wallet" / "Reset demo
dataset" in Settings (and the Demo controls) restore the starting state; "Clear all ChainBeat data" or clearing site
data removes everything, accounts included.

## Web security posture

- React escapes all rendered text; the app never uses `dangerouslySetInnerHTML` or `eval`. The only script it adds at
  run time is Google's sign-in client, and only once a client ID is configured (see above). Proposal text and memos
  are plain strings.
- **Demo accounts** ([AUTH.md](AUTH.md)): passwords are hashed with PBKDF2-HMAC-SHA512 (210 000 rounds, random salt) via
  Web Crypto, which exists only in a secure context (https or localhost) — elsewhere the forms say so instead of
  falling back to something weaker; sign-in uses one generic error, a dummy hash for unknown accounts and a 60-second
  lock after five failures; one-time codes are uniformly random, single-use, expire after 5 minutes, allow 5 guesses
  and are rate-limited; the `?next=` redirect accepts only same-origin paths. **Limits:** all of this runs in the
  visitor's browser, so it demonstrates the flows but protects nothing — a script on the page or the visitor
  themselves can edit the records, and the Google ID token's signature is not verified (there is no server to do it).
- CSV export (metrics, validators) writes only values generated by the simulator, quoted per RFC 4180. It does
  **not** guard against spreadsheet formula injection, because no user-supplied or on-chain text is exported. That
  changes with a live provider: validator monikers and similar fields are attacker-controlled on a real chain, so
  before exporting them, prefix any cell that starts with `=`, `+`, `-`, `@`, tab or carriage return.
- User input (search, amounts, addresses, memos, proposal drafts) is validated with Zod / explicit parsers before
  use; addresses are checked including their bech32 checksum and network prefix.
- Dependencies are pinned by `package-lock.json`. Run `npm audit` before deploying; it was not part of this
  project's verification.

### If you deploy it

Serve it as static files over HTTPS. A strict Content-Security-Policy suits this app because everything is
same-origin and no script is inline (the pre-paint theme bootstrap is the external `public/theme-init.js`). The
policy in [`nginx.conf`](../nginx.conf) is:

```
default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client;
style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data:; font-src 'self' data:;
connect-src 'self' https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/;
object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
```

- `style-src 'unsafe-inline'`: components set inline `style` attributes (colours, sizes) and a Radix dependency
  injects a `<style>` element at runtime.
- `font-src data:`: Vite inlines the smallest font subsets into the CSS as `data:` URIs.
- The four `https://accounts.google.com/gsi/…` entries are the endpoints Google documents for Google Identity
  Services and are needed **only** for the optional Google button ([AUTH.md](AUTH.md#google-sign-in)); remove them if
  you do not offer it. Without them the button's script is blocked and the page shows "The Google button could not be
  loaded". Nothing from Google is requested unless a client ID is configured.
- The version of this policy **without** the Google entries was exercised in Chromium against the production build
  (dialogs, popovers, language switch with lazy locale chunk and web font, CSV download, charts, mobile drawer, light
  and dark themes): no violations, and with the whole app bundle blocked the external script alone still applied the
  saved theme. The version **with** the Google entries was exercised on `/login` only: with a well-formed but
  non-existent client ID Google's script, stylesheet and button iframe loaded and Google's button rendered, with no
  CSP violation reported; completing a real sign-in needs a real client ID and was not done. The sign-in pages build
  Zod schemas, and Zod's optional "compile with `new Function`" probe is blocked by this policy, so
  `src/main.tsx` sets `z.config({ jitless: true })` to avoid it (before that, the probe showed up as one harmless
  `script-src` violation report per page that builds a schema). The nginx configuration itself was **not** run (see
  LIMITATIONS.md).

Also send `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and configure the SPA fallback
(`/*` → `/index.html`); `nginx.conf` does all of this. If you build with `VITE_COSMOS_REST_URL` (the Test
connection button), add that endpoint's origin to `connect-src`, otherwise the browser will block the test; treat
every response from it as untrusted input (the client already validates its shape). For the Google button, also
add your site's origin under "Authorized JavaScript origins" in the Google Cloud console.

### Transaction safety in Demo Mode

Every Demo wallet action goes through one review → confirm → cancel dialog that repeats, in words, that nothing is
signed or broadcast. The "Simulate network errors" demo control makes confirmations fail (toast, notification, no
state change), so the failure path is exercisable. Amounts are validated for decimal precision, balance and
fee before the review step is offered, and every simulated transaction the wallet creates has a hash starting
with `DE0DE0`, so it can never be confused with — or looked up as — a simulated chain transaction.

## Before connecting real chains or funds

This repo deliberately stops short of that. A production wallet integration additionally needs: a threat model for
the signing flow, transaction simulation/preview, chain-ID and address-prefix pinning, replay and phishing
protection, rate limiting and caching for RPC use, and an independent security review. None of that exists here.
