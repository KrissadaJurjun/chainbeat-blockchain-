# ChainBeat

A multilingual blockchain explorer and Web3 analytics dashboard: a dashboard with an interactive multi-series overview
chart, on-chain metrics, proposals, validators, developer activity and active repositories; a full explorer (search,
blocks, transactions, accounts, validators, tokens); governance; a simulated wallet (portfolio, swap, stake, liquid
staking, send, vote, create proposal); analytics (market, network, governance, developers, dominance); and
visualisations (IBC network with zoom and pan, multichain overview, heartbeat monitor, validator bubbles). It
speaks **60 languages**, four of them right-to-left. It also includes an optional **demo account** system — sign in,
register, forgot username, forgot password, one-time codes and a "Sign in with Google" button — that runs entirely in the
browser ([docs/AUTH.md](docs/AUTH.md)).

> **ChainBeat runs in Demo Mode. Every block, price, validator, proposal and balance you see is generated in your
> browser by a deterministic simulator. Nothing is read from a real blockchain, no wallet funds are involved, and no
> transaction is ever signed or broadcast.** The interface says so wherever it matters (header chip, footer, About
> page, notifications, every wallet workflow). See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for the full, honest
> list of what is and is not real.

## Status at a glance

| Area | Status |
| --- | --- |
| Dashboard, Explorer, governance, analytics, visualisations, settings, notifications, 404, route-aware titles | **Complete** — on simulated data |
| Demo wallet (connect/disconnect, portfolio, send, swap, stake, liquid staking, vote, create proposal; review → confirm → cancel; persisted; synthetic transactions visible in the explorer) | **Complete** — simulated, nothing is ever sent anywhere |
| Responsive layouts 320 → 1920 px (**full-screen**: no outer frame or margin at any width), dark/light/system themes, reduced motion, compact layout | **Complete**, checked in Chrome only |
| **60 interface languages** (en, th, ja, zh-CN, zh-TW, ko, fr, de, es, pt-BR, it, nl, sv, nb, da, fi, pl, cs, sk, hu, ro, bg, el, tr, ru, uk, sr, hr, bs, sl, sq, mk, et, lv, lt, ar, he, fa, ur, hi, bn, pa, gu, mr, ta, te, kn, ml, ne, si, my, km, lo, vi, id, ms, fil, sw, am, ha) | **Complete catalogs** (every key, plural form and placeholder, checked automatically) — **machine-assisted and not reviewed by native speakers; professional review is recommended before public use** ([docs/I18N.md](docs/I18N.md)) |
| **Demo accounts**: `/login`, `/register`, `/forgot-username`, `/forgot-password`, `/account`; one-time codes; Google sign-in | **Complete as a front-end demo** — accounts live in the browser, codes appear in an on-page Demo inbox (**no real email or SMS is sent**), Google sign-in is real only with your own client ID and was **not** run with a real client ID and Google account ([docs/AUTH.md](docs/AUTH.md)) |
| Keplr / Leap connection | Implemented **read-only** (public address only); **never run against the real extensions** |
| Live blockchain data | **Not implemented.** A tested Cosmos REST client exists, wired only to Settings → "Test connection" when an endpoint is configured |
| Real transactions / signing | **Never** — by design |
| Screen-reader testing, Firefox/Safari, real devices, performance profiling | **Not done** |

## Quick start

Requirements: **Node.js 20.19+ or 22.12+** (a Vite 8 requirement) and npm.

```bash
npm install            # if your shell exports NODE_ENV=production, use: npm install --include=dev
npm run dev            # http://localhost:5173
```

> **Check `NODE_ENV`.** Some machines export `NODE_ENV=production` globally (`echo $NODE_ENV`, or `$env:NODE_ENV` in
> PowerShell). With it set, npm silently skips dev dependencies (hence `--include=dev`) and the dev server may behave
> like a production build. For development, unset it or use `NODE_ENV=development`. Builds and both test suites work
> either way.

No account, API key, private key or seed phrase is needed (a demo account is optional, and never involves a wallet).
Apart from loading its own files (route and language chunks are fetched on demand; fonts are bundled), the app makes no
network requests at runtime, except the two optional, explicit ones in [docs/SECURITY.md](docs/SECURITY.md) (Settings →
Test connection; the Google button once a client ID exists).

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Strict type-check, then production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc` for the app and for the node-side configs/tests |
| `npm run lint` | ESLint (typescript-eslint, react-hooks, react-refresh) |
| `npm test` | Vitest unit + component tests (jsdom, Testing Library) |
| `npm run test:coverage` | The same with a V8 coverage report |
| `npm run test:e2e` | Playwright end-to-end tests against the production build (see below) |
| `npm run i18n:check` | All 60 locales have exactly English's keys, plural forms and `{{placeholders}}` (flag `--unused` lists dead keys) |
| `npm run verify` | typecheck + lint + i18n check + unit tests + build |

**End-to-end tests** build the app and drive a real browser (responsive layouts from 1920×1080 down to 320×640,
keyboard navigation, wallet workflows, all 60 languages, axe-core accessibility audits in dark and light themes). You
do not have to download a browser if Chrome or Edge is installed:

```bash
PW_CHANNEL=chrome npm run test:e2e          # installed Google Chrome   (PowerShell: $env:PW_CHANNEL='chrome')
PW_CHANNEL=msedge npm run test:e2e          # installed Microsoft Edge
npx playwright install chromium && npm run test:e2e   # or let Playwright fetch its own Chromium
```

### Configuration

All optional and non-secret — see [.env.example](.env.example). `VITE_*` values are embedded in the public bundle, so
never put secrets in them (the app needs none): `VITE_BASE_PATH` (sub-path hosting), `VITE_DEFAULT_CHAIN`,
`VITE_SIM_LATENCY_MS`, `VITE_DOCS_URL` and `VITE_GITHUB_URL` (footer links, shown only when set),
`VITE_COSMOS_REST_URL` (adds the "Test connection" button in Settings; nothing else changes), and `VITE_GOOGLE_CLIENT_ID`
(a *public* Google OAuth client ID that turns the simulated "Sign in with Google" button into Google's real one — never a
client secret; see [docs/AUTH.md](docs/AUTH.md#google-sign-in)).

## What is in the app

| Area | Routes |
| --- | --- |
| Dashboard | `/` (also `/dashboard`) — Overview chart (24H / 7D / 30D / 90D, series toggles, tooltip, keyboard and touch), On-chain Metrics (10 cards with explanation dialogs and CSV export), Proposals panel (counts, featured proposal, status filter, pagination, demo vote / create), Validator Activities, developer heatmap, Active Repository, footer |
| Explorer | `/explorer`, `/explorer/blocks`, `/explorer/blocks/:height`, `/explorer/transactions`, `/explorer/transactions/:hash`, `/explorer/accounts/:address`, `/explorer/validators`, `/explorer/validators/:address`, `/explorer/tokens` |
| Wallet (simulated) | `/wallet` → `/wallet/portfolio`, `/wallet/swap`, `/wallet/stake`, `/wallet/liquid-staking`, `/wallet/send`, `/wallet/vote` |
| Governance | `/governance`, `/governance/proposals`, `/governance/proposals/:id`, `/governance/create` — the proposal list (stat cards, status filters, search by number, title, description, category or status; the filter and search live in the address, so "back" from a proposal returns to the same view); a proposal's page (proposer, submitted / voting starts / voting ends, deposit, tally, quorum and turnout, history, copy its number, share its link, demo vote with a confirmation — one vote per proposal, changeable); create a simulated proposal (category including "Other", voting period, live preview, save / restore / discard a draft, review → confirm, cancel) |
| Analytics | `/analytics/market`, `/analytics/network`, `/analytics/governance`, `/analytics/developers`, `/analytics/dominance` |
| Visualisations | `/visualizations/ibc`, `/visualizations/multichain`, `/visualizations/heartbeat`, `/visualizations/validators` |
| Demo account (optional) | `/login`, `/register`, `/forgot-username`, `/forgot-password` (slim layout, no sidebar), `/account` |
| Other | `/settings`, `/about`, a styled 404; version-1 addresses redirect |

Highlights:

- **Search** (`/` or Ctrl/⌘ K): block height, transaction hash, account or validator address, proposal number, token
  denom, page names — categorised results, recent searches, keyboard selection, loading/empty/invalid states with
  reasons (bad checksum, wrong hash length…).
- **Tables**: sorting, filtering, pagination, copy, CSV export, mobile cards for transactions, skeletons and empty/error
  states.
- **Wallet flows** all go through one review → confirm → cancel dialog that repeats that nothing is signed or
  broadcast; amounts are validated (decimal precision, balance, fee); every action leaves a synthetic transaction
  (hash starting `DE0DE0`) that the explorer lists, labelled "Demo wallet". The Demo control "Simulate network errors"
  makes confirmations fail so the failure path can be seen.
- **Notifications**: a bell with unread count, mark read / all, dismiss / clear all, timestamps, empty state; wallet,
  simulated-transaction, proposal, network-switch and warning events, plus the simulated network feed.
- **Settings**: theme (dark / light / system), reduced motion, compact layout, language (searchable, 60), network
  (and a "Live" source that is explained as unavailable), refresh preference, simulation speed, reset demo dataset /
  wallet, clear recent searches, privacy (what is stored; no seed phrase ever).
- **Demo accounts** ([docs/AUTH.md](docs/AUTH.md)): username or email + password with a strength meter and checklist,
  one-time codes (6 digits, 5 minutes, 5 guesses, resend cooldown) delivered to an on-page **Demo inbox**, "forgot
  username" and "forgot password" that never reveal whether an account exists, a lock-out after five failed sign-ins, sessions
  of 12 hours or 30 days, a simulated Google sign-in, and — with your own client ID — the real Google button.
- **Simulation controls** (header "Demo Mode" chip and Settings): pause / slow / normal clock, advance an hour or a
  day, add latency, force errors, reset.

Two networks are selectable (Cosmos Hub, Osmosis); further Cosmos-ecosystem chains are registered for the multichain
views only.

## Demo Mode, wallets and live data

- **Demo engine.** All data is a pure function of `(seed, simulated time)` — reloads and tests are reproducible.
  It holds two selectable networks, an unbounded block and transaction history, 180 validators on Cosmos Hub, 830
  proposals, ≥ 90 days of chart history, 365 days of developer activity, 13 tokens, five fictional repositories, and a
  Demo wallet with a full history. Hashes are deterministic and invertible; nothing is stored. See
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Wallets.** The Demo wallet (fictional balances for ATOM, OSMO, USDC and more; persisted non-sensitive state) is fully
  exercised. A Keplr or Leap extension can be connected **read-only** (public address and account name; never a seed
  phrase, key or signature; nothing persisted; accurate local disconnect), but that adapter has **not been run against the
  real extensions**. While one is connected, the simulated workflows are disabled and say why, and real transfers are
  never submitted.
- **Live data.** `ChainDataProvider` is the seam for a live source and the Demo provider implements all of it. No live
  provider exists. With `VITE_COSMOS_REST_URL` set, Settings offers **Test connection**: two read-only requests, Zod-validated,
  with timeout and rate limit, whose result is shown and stored nowhere. The app never mixes live and simulated data and
  never shows simulated data under a "live" label.

## Languages

60 locales, 18 namespaces, lazy-loaded per language, searchable switcher (native name, English name, code), saved choice →
browser language → English, right-to-left for Arabic, Hebrew, Persian and Urdu (logical CSS; hashes and addresses stay
left-to-right), per-script fonts, `Intl` formatting for numbers, dates, relative time and plurals. **The translations
were produced by a local machine-translation model plus a hand-written 130-term glossary per language (and, for
eight languages, written by the AI that built the project). None has been reviewed by a native speaker; professional
linguistic review is recommended before any public launch.** Automated checks prove completeness, not quality. Details,
the full language table and how to add or change strings: [docs/I18N.md](docs/I18N.md) and
[scripts/mt/README.md](scripts/mt/README.md).

## Tests and verification

`npm run verify` runs the type-check, lint, i18n check, unit tests and the production build. `npm run test:e2e` adds the
browser tests. What they cover, and — just as important — what they do **not**, is in
[docs/LIMITATIONS.md](docs/LIMITATIONS.md). In short:

| Level | Tool | Covers |
| --- | --- | --- |
| Unit / component / page | Vitest + Testing Library (jsdom) | simulator invariants and data consistency, formatting, search classification, transaction filters and CSV, pagination, governance/consensus maths, Demo transactions, wallet review → confirm flows and balances, the governance pages (search, history, copy / share, save / restore / discard a draft, review → confirm with the chosen voting period), notifications, settings persistence, every page rendering, the REST client (mocked `fetch`), locale detection, RTL detection, all 60 locales, the demo accounts (password hashing and policy, one-time-code rules, the register / forgot flows, lock-outs, Google token claims, the sign-in pages through the real UI) |
| End to end | Playwright (Chrome/Edge/Chromium, production build) | the full-screen shell at the ten sizes of the brief (header on the top edge, sidebar on the left edge, no frame), dashboard, chart and metric cards, search → transaction details → copy hash, wallet connect/transfer/swap/stake/vote/create-proposal, governance (search, "back" keeps the view, history, copy / share, categories, voting period, drafts, cancel, review → confirm; the three governance pages at the ten sizes and in all 60 languages at 320 and 1765 px), notifications, settings, network switching, IBC zoom, 11 viewport sizes (1920×1080 → 320×640), mobile menu, all 60 languages (shell, direction, overflow, metric cards), RTL, the demo accounts (register → code in the Demo inbox → sign in, forgot username / password, code expiry with a fake clock, the Google button against a stub of Google's script, no request leaves the origin, all 60 languages on the sign-in pages) |
| Accessibility | axe-core in Playwright | WCAG 2.1 A/AA (serious and critical fail) on ~24 pages, detail pages, forms and dialogs, the sign-in pages and their code step, in dark and light themes |

**Last full run (2026-11-19, Windows, Google Chrome):** `npm run verify` ✔ (type-check, lint, `i18n:check` 60/60 locales,
563 unit/component/page tests in 20 files, production build) and **408 Playwright tests ✔** (20 minutes, including all 60
languages and the axe audits). Since the previous full run (547 + 314) the app became full-screen (`fullscreen.spec.ts`,
13 browser tests) and governance gained categories, voting periods, drafts, history, copy / share and search
(`governance.test.tsx`, 13 page tests; `governance.spec.ts`, 81 browser tests of which 60 are the per-language layout
checks). Those language checks found two real layout bugs in Russian at 320 px (the proposal cards and the proposal page were
wider than the screen; the "Max" shortcut of a deposit field stuck out of its form), now fixed. A real Google sign-in and real email/SMS delivery were **not** tested.

Not verified: other browsers, real devices, screen readers, performance, the Docker/nginx/CI files, Keplr/Leap against
the real extensions, any live network, a complete Google sign-in — and no native speaker has reviewed any translation.

## Project structure

```
src/
  app/            router, navigation model, route helpers
  components/     layout, dashboard panels, charts, data table, ui primitives, search, wallet, governance, explorer
  config/         build-time configuration (public, non-secret)
  hooks/          data hooks (TanStack Query), notifications events, pan/zoom, fit-to-width text, formatting
  i18n/           registry (languages.json), namespaces, loader, fonts, locales/<code>/<namespace>.json (60 × 18)
  lib/            pure helpers: format, bech32, prng/noise, search classification, tx filters, governance, validation
  pages/          one lazy route component per page
  services/
    chain/        ChainDataProvider, the Demo provider and its engine (demo/), the live REST client
    wallet/       Demo wallet + read-only Keplr / Leap adapters
    auth/         demo accounts: password hashing, one-time codes, flows, Google Identity Services
  stores/         Zustand stores (ui, chain, simulation clock, wallet ledger, notifications, search, toasts, demo accounts, one-time codes)
  types/          domain types
scripts/          i18n tooling (check, build, export, add, remove) and the machine-translation pipeline (mt/)
tests/e2e/        Playwright specs
docs/             ARCHITECTURE, I18N, SECURITY, LIMITATIONS, AUTH
screenshots/      real screenshots (see its README for how they were taken)
reference/        the design reference for the full-screen Proposals page (chainbeat-proposals.png); the dashboard reference
                  (heartbeat-dashboard.png) is a third-party design and is not included in this repository
```

## Deployment

It is a static single-page app: `npm run build` produces `dist/`; serve it over HTTPS with the SPA fallback
(`/*` → `/index.html`). The repository includes an unprivileged-nginx `Dockerfile` and `nginx.conf` with a strict
Content-Security-Policy (see [docs/SECURITY.md](docs/SECURITY.md); it allows Google's sign-in endpoints for the optional
Google button) and a GitHub Actions workflow — **written but never
executed**. Hosting under a sub-path: build with `VITE_BASE_PATH=/chainbeat/`. If you set `VITE_COSMOS_REST_URL`, add that
origin to the CSP's `connect-src`.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, the deterministic simulator, state, charts, routing, testing
- [docs/I18N.md](docs/I18N.md) — the 60 languages, how they were produced (read the caveats), tooling, adding strings
- [docs/AUTH.md](docs/AUTH.md) — the demo accounts: what is real and what is simulated, flows, Google setup
- [docs/SECURITY.md](docs/SECURITY.md) — secrets, wallets, storage, the optional network requests, CSP
- [docs/LIMITATIONS.md](docs/LIMITATIONS.md) — what is simulated, what was not verified
- [scripts/mt/README.md](scripts/mt/README.md) — the machine-translation pipeline

## Screenshots

[screenshots/](screenshots/) holds 56 real captures (desktop, tablet, phone, light theme, explorer, wallet, governance,
analytics, visualisations, notifications, settings, the demo-account pages, and Thai, Japanese, Hindi, German, Arabic and Hebrew). They were taken
from the running app (retaken on 2026-11-19, after the app shell became full-screen). The app shell and the Proposals page
were compared with `reference/chainbeat-proposals.png` **by eye** at 1765 × 900 — no pixel diff was run. See [screenshots/README.md](screenshots/README.md).
