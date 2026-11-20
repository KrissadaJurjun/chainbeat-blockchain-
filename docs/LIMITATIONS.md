# Known limitations and what was not verified

This list is deliberately blunt. If something is not here, it is not a claim that it is perfect — it only means it
was not known to be a problem.

## What is real and what is simulated

- **All blockchain data is simulated.** Blocks, transactions, hashes, validators, proposals, prices, market data, IBC
  flows, developer activity, balances and the notification feed are generated in the browser by a deterministic
  simulator (see ARCHITECTURE.md). "Cosmos Hub" and "Osmosis" are the names of simulated networks modelled on those
  chains' *shape*; the numbers are **not** mainnet statistics, and the headline figures are anchored to the design
  reference on 2026-11-18, then drift with the simulated clock. Repositories, validators and proposal texts are
  fictional and English-only.
- **There is no live data.** `ChainDataProvider` is the intended seam for a live source and the Demo provider
  implements all of it. The only live code is a read-only Cosmos REST client (`liveClient.ts`) behind Settings → "Test
  connection", which appears only when `VITE_COSMOS_REST_URL` is set. It was tested with a mocked `fetch` (response
  validation, timeout, rate limit, partial results, malformed answers) and **never against a real node**. Nothing maps
  real responses onto the explorer's pages, so live pagination, reorgs, real hash lookup, the rate limits of real
  providers and real address history are untested territory. A "Live" data source is shown in Settings as unavailable
  rather than faked.
- **No transaction is ever signed or broadcast.** Swap, stake, liquid staking, send, vote and create-proposal change a
  local ledger of fictional balances (and leave a synthetic `DE0DE0…` transaction in the explorer). Swap rates, APR
  estimates, liquid-staking exchange rates and rewards are modelled, not on-chain. The vote weight in Demo Mode counts
  the Demo wallet's whole balance (a documented simplification so the tally visibly changes).
- **Governance is a simplified model.** A proposal has one description field (there is no separate on-chain "metadata"
  or "content" document), and "Voting starts" is the submission time — the simulation has no separate deposit-period
  timeline, so a proposal still collecting its deposit simply has no voting start yet. The voting period of a proposal
  made in Demo Mode is the visitor's choice (3, 5, 7 or 14 days, or the network's own); "Other" is a category label,
  nothing more. "Save draft" keeps **one** draft per browser in `localStorage`, restored on the next visit to the form
  (the page says so) and cleared by submitting or discarding it. A few simulated proposals share a title (the generator
  reuses its templates), so a title search can return twins with different numbers.
- **Wallets.** The Demo wallet is fully exercised. The Keplr and Leap adapters read a public address through the
  documented injected API but were **never run against the real extensions** (none were available to test with).
  CosmJS and any signing flow are not implemented. Real balances are never read.
- **Demo accounts are not real authentication** ([AUTH.md](AUTH.md)). Sign in, register, forgot username / password and
  one-time codes all work end to end, but there is **no server**: accounts are records in this browser's
  `localStorage` (a salted PBKDF2 password hash, never the password), so anyone who can run script on the page or edit
  the storage can change them, and an account made in one browser does not exist in another. **No email and no SMS is
  ever sent**: the "message" with the code appears in an on-page Demo inbox (a static site cannot send mail). Nothing
  a demo account unlocks is protected — every page stays open to everyone.
- **"Sign in with Google" is real only with your own Google OAuth client ID.** Without one it is a labelled
  simulation that never contacts Google. With one it is Google's own button; the ID token's claims are checked (`iss`,
  `aud`, `exp`, `nonce`, verified email) but its **signature is not verified** — that belongs on a server. It was
  tested against a stub of Google's script and, for rendering and the Content-Security-Policy, against the real script
  with a non-existent client ID; **a complete sign-in with a real client ID and Google account was never done** (it
  needs credentials that only you have).
- **Search and the command palette** resolve simulated entities only (pages, blocks, transactions, validators, tokens,
  proposals, and addresses that appear in the simulation or are syntactically valid).
- Account pages scan the newest few thousand simulated blocks for a pool of simulated participants; an address outside
  that pool is valid but shows no history ("it does not appear in the simulation").

## Internationalisation

- **60 languages ship with complete catalogs, but none of the 59 non-English catalogs has been reviewed by a native
  speaker.** 8 were written by the AI assistant that built the project (plus machine translation for later additions);
  51 were produced by NLLB-200 (distilled 600M) with a hand-written 130-term glossary per language and a crude
  round-trip check that flagged 15–55 % of each language's strings as low-agreement — flagged strings were not
  individually reviewed. **Professional human linguistic review is recommended before any public production launch**,
  and is essential for the lower-resource languages (Burmese, Khmer, Lao, Amharic, Hausa, Sinhala, Swahili, Nepali and the
  other Indic languages). Do not read "60 complete locales" as "60 native-quality localisations". See docs/I18N.md.
- The NLLB weights are CC-BY-NC 4.0 (non-commercial) — relevant if the generated text is reused commercially.
- The **sign-in pages' strings** (the `auth` namespace, added later) follow the same rule: Thai was written directly by
  the AI assistant; the other 58 were machine-translated with NLLB-200 and then, because the model got some of the most
  visible labels wrong (it rendered "Sign in" as "Subscribe" in Russian and "Register" in Spanish, for example), the
  labels *Sign in, Sign out, Create account, Username, Password, Email address* and the two Google button captions were
  **hand-written by the AI assistant for every language** — still not reviewed by native speakers. Longer sentences
  there (the Google setup guide, the "never share this code" warning) are raw model output and the likeliest to be
  stiff or wrong.
- The **ten governance strings** added with the full-screen Proposals work (the "Other" category, voting start, proposal
  history, copy proposal number, voting period, save / restore / discard draft): Thai written directly; 21 languages
  hand-written by the AI assistant (`ar`, `es`, `zh-CN`, `zh-TW`, `ja`, `ko`, `fr`, `de`, `pt-BR`, `it`, `nl`, `ru`,
  `uk`, `pl`, `tr`, `vi`, `id`, `hi`, `sv`, `cs`, `he`) after the model rendered some button labels as nonsense; the
  **other 37 languages keep raw model output for those ten strings, including the three button labels** (Save draft,
  Discard draft, Copy proposal number), which are the likeliest to be wrong. See docs/I18N.md.
- Only a handful of languages (Thai, Russian and a few others) were spot-checked by reading during development; the
  rest were checked only by machine (keys, plurals, placeholders, script of the output, no leftover markers, layout
  overflow).
- Demo content (proposal titles/text, repository and validator names) is English only.
- CJK text relies on system fonts; on a device with no CJK font installed the browser's fallback is used. Right-to-left
  was verified automatically (direction, overflow, left-to-right hashes) for Arabic, Hebrew, Persian and Urdu; nobody
  has visually reviewed every screen in those languages.
- Serbian ships in Cyrillic only and Norwegian as Bokmål only.

## Verification that was and was not done

Done (Windows development machine; Google Chrome via Playwright):

- TypeScript strict type-check (app and node-side configs/tests); ESLint; `npm run i18n:check` for all 60 locales.
- Vitest unit and component tests, including the simulator's invariants, pure-logic modules (search classification,
  transaction filters, governance and consensus maths, Demo transactions), the live REST client against a mocked
  `fetch`, every page rendering without React errors, wallet review → confirm flows (including simulated failure),
  notifications, settings persistence, market/IBC interactions, and every locale file.
- Playwright end-to-end tests on the production build: navigation through every sidebar item and header tab, search
  (page, block, transaction hash, invalid input), explorer drill-downs (list → block → transaction → account), wallet
  and governance workflows, notifications, settings persistence, network switching, IBC zoom, market comparison, 11
  viewport sizes from 1920×1080 to 320×640, all 60 languages at 320 px and 1280 px (translated shell, correct
  direction, no horizontal overflow, no console errors) and at 11 sizes (no cut-off metric card), right-to-left checks.
- axe-core automated accessibility audits (WCAG 2.1 A/AA; serious and critical violations fail) on the dashboard,
  explorer, governance, analytics, visualisation, settings and about pages, on detail pages, wallet forms and open
  dialogs, in dark and light themes.
- The strict Content-Security-Policy in `nginx.conf` was exercised in Chromium against the production build in the
  earlier version of this project (see SECURITY.md); it was not re-run for every page added since.
- Screenshots of the dashboard, new pages and several languages and sizes in `screenshots/` (see its README); the
  dashboard was compared with the reference screenshot **by eye**.

- The full-screen shell and governance (2026-11-19): `tests/e2e/fullscreen.spec.ts` measures the header (64 px, on the
  top-left corner), the sidebar (220 px, on the left edge) and the corners of the page at the ten sizes of the brief (1920×1080,
  1765×900, 1440×900, 1366×768, 1024×768, 768×1024, 430×932, 390×844, 375×812, 320×640), in the light theme and with the
  sidebar collapsed; `tests/e2e/governance.spec.ts` drives the proposal list (search by number, title, category,
  status; the view survives "back" and a reload), a proposal (history, copy, share) and the create form (category,
  voting period, draft, cancel, review → confirm) in the browser, checks the three pages at those ten sizes (number of
  columns, no horizontal overflow) and in all 60 languages at 320 and 1765 px; `src/pages/governance.test.tsx` covers
  the same flows in jsdom. The 1765 × 900 Proposals screenshot was compared with the reference **by eye** (see below).
- The demo-account pages ([AUTH.md](AUTH.md)): unit tests for hashing, the password policy, one-time codes (with
  controllable clocks), the multi-step flows, lock-outs, Google token claims and the redirect check; page tests that
  drive each form through the real UI; Playwright tests of the same flows on the production build, code expiry with a
  fake clock, the stubbed Google script, "no request leaves this origin", every language at 320 and 1280 px, and axe
  audits in both themes. The strict Content-Security-Policy with the Google entries was exercised against the real
  Google script on `/login` (see SECURITY.md).

**Not done:**

- A real sign-in through Google, any real email or SMS delivery, a security review of the demo-account code, and a
  review of the `auth` translations by native speakers.
- No other browsers (Firefox, Safari/WebKit, Edge) and no real phones or tablets. Touch behaviour was exercised only
  through emulation; the IBC map's drag-to-pan and zoom were exercised with synthetic pointer events and buttons.
- **No screen-reader testing** (NVDA, JAWS, VoiceOver, TalkBack). Automated audits catch only a fraction of accessibility
  problems; the ARIA patterns (combobox search, radio groups, dialogs, live regions, keyboard chart navigation, the route
  announcer) were built to standard patterns but not validated with assistive technology. WCAG 2.2 AA is the target,
  **not a claim**.
- No performance measurement (Lighthouse, bundle budgets, profiling on low-end devices). Route-level code splitting and
  lazy locale loading are in place; their effect was not measured.
- No pixel-diff against the references: "similar to the reference" is a visual judgement. The design is an original brand
  and layout built to the brief's description of those screenshots, not a copy. The full-screen shell (64 px header, 220 px
  sidebar, no outer frame) and the Proposals page were matched **by eye** to `reference/chainbeat-proposals.png` at
  1765 × 900 (sizes were measured on both and adjusted until they agreed to within a few pixels at that width; below it
  the layout is unchanged). Numbers differ from that screenshot only because the simulated clock has moved on (turnout,
  "Ends in N days" and dates shift with the simulated day; the vote percentages are identical).
- `npm audit` and a dependency licence review were not run.
- `Dockerfile`, `nginx.conf` and `.github/workflows/ci.yml` were written but **never executed**.
- The machine-translation pipeline in `scripts/mt` documents how the catalogs were made; it is not part of
  `npm run verify` and was run on one machine.

## Technical limitations worth knowing

- **Browser support:** modern evergreen browsers (container queries, `inert`, `Intl.NumberFormat` `roundingPriority`,
  `Intl.PluralRules`). Older browsers will mis-layout the metric cards or print longer CJK figures.
- **Simulated clock:** numbers move with real time (a new block roughly every 6 s, drifting prices) unless paused or
  slowed. The Demo controls can advance the clock or reset it to real time.
- **Time zones:** timestamps display in the browser's time zone (tests pin UTC).
- **Persistence is per browser:** the demo wallet, demo accounts, notifications and preferences live in
  `localStorage`; they do not sync across devices and disappear when site data is cleared.
- **Charts:** Recharts and hand-written SVG; fine for the supported ranges (a few hundred points per series) but not
  virtualised for very large datasets. The chart text alternatives are summaries and legends, not full data tables.
- **Development environment:** Vite 8 needs Node 20.19+ or 22.12+. A global `NODE_ENV=production` makes npm skip dev
  dependencies (use `npm install --include=dev`) — see the README.
