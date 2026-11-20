# Architecture

ChainBeat is a client-side single-page app. There is no backend: the "network" is a deterministic simulator that
runs in the browser behind a provider interface, so a live data source can replace it without touching the UI.

```
pages / components ──► hooks (TanStack Query) ──► ChainDataProvider ──► demo engine ──► lib (prng, noise, bech32)
        │                                              (interface)        (simulation)
        └──► Zustand stores (ui, chain, sim clock, wallet ledger, notifications, toasts)
```

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Pages | `src/pages/` | One lazy-loaded component per route; compose panels, own page-level state. |
| Components | `src/components/` | `layout` (header, sidebar, notifications bell, dialogs), `dashboard` panels, `charts` (incl. pan/zoom controls and chart keys), `data` (table), `ui` primitives (Radix-based, themed; `Drawer`, `JsonViewer`), `search`, `wallet`, `governance`, `explorer`, `brand`. |
| Hooks | `src/hooks/` | `useChainData.ts` wraps every provider call in a TanStack Query hook (keys include provider, chain and the inputs; polling follows the user's refresh preference via `useRefreshMs`). `useGovernance`, `useDemoTx`, `useNotificationEvents`, `usePanZoom`, `useFitText`, formatting, media queries, reduced motion. |
| Provider | `src/services/chain/provider.ts` | `ChainDataProvider` — the only thing the UI knows about data. Every method returns a `Promise` and accepts an `AbortSignal`. |
| Demo engine | `src/services/chain/demo/` | `model` (tokenomics per chain), `prices`, `validators` (+ `validatorDetail`, concentration trend), `blocks`, `metrics`, `governance`, `accounts` and `pool` (240 simulated accounts per chain), `ecosystem`, `feed`, `ids`. |
| Live client | `src/services/chain/liveClient.ts` | A read-only Cosmos REST client (Zod-validated, timeout, rate limit, `partial` results, `UnsupportedFeatureError`). Only its connection probe is wired in (Settings → Test connection); it is **not** a provider. |
| Wallet | `src/services/wallet/` | `WalletAdapter` interface; the simulated Demo wallet and read-only Keplr / Leap adapters. |
| Demo accounts | `src/services/auth/`, `src/components/auth/`, five pages | The optional sign-in system ([AUTH.md](AUTH.md)): password hashing and policy, one-time codes, the register / forgot-username / forgot-password flows, Google Identity Services (claims checked, signature not), all in the browser. `flows.ts` is the seam a real server would replace. |
| State | `src/stores/` | Small Zustand stores; only user preferences and the demo ledger are persisted (see SECURITY.md). |
| Pure helpers | `src/lib/` | Formatting (`Intl`), bech32, seeded PRNG and noise, chart maths, CSV, validation, consensus maths. |

`src/services/chain/index.ts` exports the active provider (`export const provider = demoProvider`). A live
provider (Cosmos REST/RPC, an EVM adapter, an indexer) would implement the same interface and be registered there.
That seam is designed and the Demo provider exercises all of it, but **no live provider exists in this repo**: the
`liveClient` is a tested building block (and a connection test), so pagination, real hash lookup, reorg handling and the
mapping of real responses onto every `ChainDataProvider` method are still to be done. A method the live adapter cannot
serve must throw `UnsupportedFeatureError` — never return demo data under a "live" label.

## The deterministic simulator

Everything the demo shows is a **pure function of `(seed, time)`** — no stored database, no `Math.random()`.
Reloading the page, opening the same block twice or running the tests twice produces identical numbers.

- **Clock.** `getSimNow()` is derived from an anchor (`anchorSim` at `anchorReal`) and a speed — **paused**, **slow**
  (0.2×) or **normal** — so changing the speed never jumps the clock. The Demo controls and Settings can pause, slow
  down, advance by an hour or a day, or reset it; any change invalidates the queries, so new blocks, prices and events
  appear. The headline figures are anchored so that on `SIM_TARGET_MS` (2026-11-18) they match the design reference
  exactly (`slowNoiseFromTarget` is zero at the target).
- **Prices.** `priceNoise` sums several seeded sine "spectra" of different periods, so charts have believable
  short-term wiggle and slow drift, and any time range can be sampled without simulating the history in between.
- **One consistent economic model per chain** (`demo/model.ts`), so the dashboard never contradicts itself:
  bonded tokens = total supply × bonded ratio; staking APR = inflation × (1 − community tax) ÷ bonded ratio;
  community-pool value = pool × token price; block time and transactions-per-block are *measured from the same
  blocks the Blocks page lists*; the active validators' voting power sums to 100 % of the bonded stake.
- **Identifiers.** Block and transaction hashes are invertible: `encodeRef` scrambles `(kind, height, index)` into a
  48-bit prefix and adds a seeded tail, so `decodeRef(hash)` recovers the block and index in O(1) and
  `/explorer/transactions/:hash` needs no index. Addresses are real bech32 (`cosmos1…`, `osmo1…`) with a valid
  checksum (`lib/bech32.ts`), which is what the Send form validates.
- **One world, many views.** Dashboard counters, the block and transaction tables, validator pages, account pages and
  the search results all read the same pure functions, so an address shown in a transaction opens an account page whose
  history contains that transaction. Account histories are found by scanning the newest simulated blocks for a pool of
  simulated participants (`demo/accounts.ts`, `demo/pool.ts`).
- **Demo wallet transactions.** Sends, swaps, stakes, votes and proposals made with the Demo wallet leave a synthetic
  transaction (hash prefixed `DE0DE0`, never a valid chain hash) in the wallet's ledger. The transaction list, the block
  page at that height and the account page of the Demo address merge them in, labelled "Demo wallet".
- **Latency and failure.** `demoProvider` waits `latencyMs` (default 280 ms, configurable, 0 in tests) and can be
  forced to throw `SimulatedNetworkError`, which is how loading, error and retry states are exercised.

## State and persistence

| Store | Persisted key | Contents |
| --- | --- | --- |
| `uiStore` | `chainbeat.ui` | theme, reduced motion, compact layout, refresh preference, sidebar collapsed, collapsed sections, favourites (transient: drawer and dialog state) |
| `chainStore` | `chainbeat.chain` | selected network |
| `simStore` | `chainbeat.sim` | clock anchor and speed, simulated latency (forced errors are never persisted) |
| `walletStore` | `chainbeat.wallet` | the **Demo** wallet only: balances, delegations, activity (with its synthetic transactions), votes, the simulated proposals made with it (each with its category and chosen voting period) and **one saved draft** of the Create Proposal form (kept per browser; submitting or discarding it clears it). A real Keplr/Leap connection is never written to storage. |
| `notificationStore` | `chainbeat.notifications` | read and dismissed ids, plus the local event notifications |
| `searchStore` | `chainbeat.search` | the last 8 searches |
| `authStore` | `chainbeat.auth` | the optional demo accounts (salted password hashes), the current session, failed-sign-in counters, a pasted Google client ID |
| `otpStore` | — (memory only) | pending one-time codes, send log for rate limiting, and the Demo inbox; a reload forgets them |
| i18n | `chainbeat.lang` | selected language |

All storage access goes through `lib/storage.ts`, which survives private windows and blocked storage.

Server-style state (everything that comes from a provider) lives in TanStack Query, never in Zustand.

### Notifications

The bell merges two sources: the **simulated network feed** (`demo/feed.ts`: proposals in voting, a decided proposal, a
jailed validator, an upgrade, IBC volume, a block milestone every 5,000 blocks) and **local events**. Local events are
produced in one place: `useNotificationEvents` (mounted by the app shell) subscribes to the wallet, chain and sim stores
and calls `lib/notify.ts` — wallet connected/disconnected, a confirmed simulated transaction, a drafted proposal, a
network switch, "simulation paused", "error simulation on" — plus a simulated failure raised by the confirmation dialog
when error simulation is on. Notifications are stored as a message **key plus parameters**, so changing language
re-translates the whole list, and each one says what it is; none is ever presented as a live blockchain alert.

## Charts

- **Overview chart** — hand-written SVG (not a charting library) because the design needs behaviour libraries make
  awkward: an index chart based at 100, monotone cubic curves (Fritsch–Carlson, so splines never overshoot), a glow,
  a spotlight band with a block grid behind it, a tooltip card, series toggles, calendar-aligned time ticks
  (`niceTimeTicks`), and keyboard, pointer and touch interaction with a live region for screen readers.
- **Analytics pages** use Recharts; the IBC graph (with drag-to-pan, Ctrl/⌘+wheel and button zoom, keyboard
  shortcuts and a reset — `usePanZoom`), heartbeat/ECG monitor, contribution heatmap, sparklines and validator
  bubbles are custom SVG.
- Chart colours come from the theme tokens, and every chart has a text alternative (summary, table or live region).

## Routing and code splitting

React Router with a data router; every page is a `lazy` route, so the initial bundle holds only the shell and the
dashboard. `HydrateFallback` shows a branded boot screen; `RouteError` catches render errors per route; unknown
URLs render a 404 inside the shell; `RouteAnnouncer` tells screen readers about client-side navigation. All paths are
defined once in `src/lib/paths.ts` (`/explorer/**`, `/wallet/**`, `/governance/**`, `/analytics/**`,
`/visualizations/**`, `/settings`, `/about`, `/account`); version-1 addresses (`/validators`, `/blocks/:height`, …)
redirect to their new homes. Page titles follow the route (`useDocumentTitle`). There are two route groups: the app
shell (header, sidebar, footer) and a slimmer `AuthLayout` for `/login`, `/register`, `/forgot-username` and
`/forgot-password` (language and theme pickers, no sidebar); static paths outrank the shell's `*` 404 route.

## Theming, layout and accessibility decisions

- Design tokens are CSS variables in `src/index.css` (dark by default, light and "system" supported); the dark and
  light palettes were audited for WCAG AA contrast, and the audit is repeated by axe-core in the e2e suite.
- **The app is full-screen** at every width: it fills the browser viewport with no outer margin, backdrop, rounded
  "window" or frame (`AppShell`; an end-to-end test probes the four corners at ten viewport sizes). Desktop (≥ 1024 px):
  the 64 px header on the top edge, the 220 px sidebar (68 px collapsed, scrolling on its own) on the left edge and the
  content area scrolling internally; below that the sidebar becomes a drawer (Radix Dialog: focus trap, Esc, focus returns
  to the trigger). Metric cards use container queries so they adapt to
  the space they are given rather than to the viewport.
- Localised text can be longer than English: labels wrap to two lines, figures shrink to fit (`useFitText`) before
  they would ever be cut, and grid items use `min-width: 0` so a long cell cannot widen the page.
- Direction follows the language (`dir` on `<html>`); layout uses logical properties (`start`/`end`).
- `prefers-reduced-motion` (and an in-app switch) disables non-essential animation.

## Testing strategy

| Level | Tool | What it proves |
| --- | --- | --- |
| Unit | Vitest | Simulator invariants (determinism, economic identities, hash round-trips), bech32, formatting, chart maths, search-query classification, transaction filtering/CSV, governance and consensus maths, Demo transactions, stores, the live REST client (mocked `fetch`), i18n completeness for all 60 locales. |
| Component / page | Vitest + Testing Library | Rendering of every page, forms and validation, review → confirm wallet workflows (incl. simulated failure), notifications, settings persistence, market/IBC interactions, accessibility names and roles, loading/error states. |
| End to end | Playwright (Chrome/Edge/Chromium) | Real-browser flows on the production build, 11 viewports from 1920×1080 to 320×640, all 60 languages for overflow, direction and cut-off metrics, persistence across reloads, keyboard operation. |
| Accessibility | axe-core inside Playwright | No automated violations on the main pages, forms and dialogs, in dark and light themes. |
