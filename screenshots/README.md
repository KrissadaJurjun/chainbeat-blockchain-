# Screenshots

Real captures of the running app, retaken on 2026-11-19 — after the app became full-screen, with no outer frame — with
headless Chromium (the Playwright driver) against the production build served by `vite preview`, in the dark theme
unless the name says otherwise, with the Demo wallet connected only where the page needs it
(portfolio, send dialog, transactions with the Demo wallet filter, create proposal). Everything shown is simulated data.

**These are screenshots, not a visual-regression suite.** The app shell and the Proposals page (`21`) were compared with
[`../reference/chainbeat-proposals.png`](../reference/chainbeat-proposals.png) by eye at 1765 × 900 (these captures are
1440 × 900); the dashboard's content was built to `reference/heartbeat-dashboard.png` (a third-party design, so it is not included
in this repository), whose framed-"window" look was deliberately dropped when the app became full-screen. No pixel diff or similarity score
was computed, and none is claimed.

| File | What it shows |
| --- | --- |
| `01-dashboard-desktop`, `02-dashboard-light` | Dashboard, 1440×900, dark and light |
| `03-dashboard-tablet-768`, `04-dashboard-mobile-390`, `05-mobile-menu-390` | Tablet and phone layouts; the mobile navigation drawer |
| `10-explorer-home` … `17-validator-detail` | Explorer home, blocks, block details, transactions, transaction details, an account, validators, a validator's page |
| `13b-transactions-demo-wallet-filter` | A transfer made with the Demo wallet, found in the transaction list via the "Demo wallet" filter |
| `20-governance-hub`, `21-proposals`, `22-proposal-detail`, `23-create-proposal` | Governance hub, proposal list, a proposal (proposer, voting start and end, tally, vote, **history**, copy number, share), the create-proposal form (category "Other", voting period 3 days) |
| `21b-proposals-1765x900` | The Proposals page at the size of the reference screenshot (1765 × 900), for comparing with [`../reference/chainbeat-proposals.png`](../reference/chainbeat-proposals.png). Same layout; the day-dependent numbers (turnout, "Ends in N days", the bell's count) differ because the simulated clock has moved on |
| `24-create-proposal-review`, `25-create-proposal-draft-restored`, `26-proposals-search` | The review dialog before a simulated proposal is created (it repeats the category and voting period); the form with a saved draft restored (after a reload); the proposal list filtered by a search ("software upgrade") |
| `30-wallet-portfolio`, `31-send-review-dialog` | Demo wallet portfolio; the review → confirm dialog of a send |
| `40-market` … `44-dominance-stacked` | Market, network health, governance analytics, developer analytics, dominance (stacked view) |
| `50-ibc-zoomed-selected`, `51-multichain`, `52-heartbeat` | IBC map zoomed with a chain selected, multichain overview, heartbeat monitor |
| `60-notifications`, `61-search-results`, `63-language-picker`, `64-demo-controls` | Notification bell, global search, the 60-language picker, the Demo controls |
| `62-settings`, `65-404`, `66-about` | Settings, the 404 page, About |
| `70-dashboard-th`, `73-dashboard-ja`, `74-dashboard-hi`, `76-validators-de` | Thai, Japanese, Hindi, German |
| `71-dashboard-ar-rtl`, `72-dashboard-he-rtl`, `75-dashboard-ar-mobile` | Arabic and Hebrew right-to-left, Arabic on a phone |

| `80-login` … `82-register-details` | The optional demo-account pages (added 2026-11-19, captured from the production build with `vite preview`, 1440×900, dark theme): sign in, the "Set up real Google sign-in" guide, register with the password strength meter and checklist |
| `83-register-code-step-demo-inbox`, `84-register-done` | The one-time-code step with the **Demo inbox** beside it (this build sends no email or SMS: the "message" appears here), and the confirmation |
| `85-account`, `86-account-menu` | The signed-in account page and the header account menu (the avatar shows the username's initial) |
| `87-forgot-password`, `88-forgot-username` | The two recovery pages (first step) |
| `89-login-light`, `90-login-th`, `91-login-ar-rtl`, `92-register-code-step-mobile` | Sign in in the light theme, in Thai and in Arabic (right-to-left), and the code step on a 390 px phone (full page) |
| `93-login-google-real-button-fake-client-id` | **Google's real button**, rendered by Google's own script inside the page under the strict Content-Security-Policy from `nginx.conf` (served by a small local test server, hence port 4181 in the guide text), using a well-formed but **non-existent** client ID — clicking it would only produce a Google error. The button's label is in Thai because Google localises it from the browser's language. It shows that the integration loads and renders; it is **not** a completed sign-in |

The accounts, addresses and codes in the sign-in screenshots are made up (`alex@example.com`; the codes are random each run).
The translations visible in the language screenshots are machine-assisted and have not been reviewed by native speakers
(see [../docs/I18N.md](../docs/I18N.md)).
