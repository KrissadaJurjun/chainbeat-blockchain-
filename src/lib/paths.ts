/** Every route of the app in one place, so links cannot drift from the router. Pure strings, no dependencies. */
const enc = encodeURIComponent;

export const paths = {
  home: '/',
  dashboard: '/dashboard',

  explorer: '/explorer',
  blocks: '/explorer/blocks',
  block: (height: number | string): string => '/explorer/blocks/' + height,
  transactions: '/explorer/transactions',
  tx: (hash: string): string => '/explorer/transactions/' + hash,
  /** `at` is the height of a transaction the visitor came from, so older activity around it is included. */
  account: (address: string, at?: number): string => '/explorer/accounts/' + address + (at ? '?at=' + at : ''),
  validators: '/explorer/validators',
  validator: (address: string): string => '/explorer/validators/' + address,
  tokens: '/explorer/tokens',

  wallet: '/wallet',
  portfolio: '/wallet/portfolio',
  swap: '/wallet/swap',
  stake: '/wallet/stake',
  liquidStaking: '/wallet/liquid-staking',
  send: '/wallet/send',
  vote: '/wallet/vote',

  governance: '/governance',
  proposals: '/governance/proposals',
  proposal: (id: number | string): string => '/governance/proposals/' + id,
  createProposal: '/governance/create',

  market: '/analytics/market',
  network: '/analytics/network',
  governanceAnalytics: '/analytics/governance',
  developers: '/analytics/developers',
  dominance: '/analytics/dominance',

  ibc: '/visualizations/ibc',
  multichain: '/visualizations/multichain',
  heartbeat: '/visualizations/heartbeat',
  validatorsViz: '/visualizations/validators',

  settings: '/settings',
  about: '/about',

  /** Optional demo accounts (see docs/AUTH.md). The first four share a lightweight layout without the sidebar. */
  login: '/login',
  register: '/register',
  forgotUsername: '/forgot-username',
  forgotPassword: '/forgot-password',
  myAccount: '/account',

  /** Query-string links into a list page. */
  validatorsFor: (query: string): string => '/explorer/validators?q=' + enc(query),
  tokensFor: (query: string): string => '/explorer/tokens?q=' + enc(query),
  transactionsFor: (query: string): string => '/explorer/transactions?q=' + enc(query),
} as const;

/** The pages of the sign-in flow. After signing in, a visitor is never sent back to one of these. */
export const AUTH_PATHS: readonly string[] = [paths.login, paths.register, paths.forgotUsername, paths.forgotPassword];

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Where to go after signing in, taken from the `?next=` query parameter. Only a same-origin path inside this app is
 * accepted (`/explorer/blocks`, not `//evil.example`, `https://…` or `/\evil`), and never one of the sign-in pages, so the
 * parameter cannot be used as an open redirect or to bounce the visitor back and forth. Anything else returns `null`.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 300) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || hasControlCharacter(raw)) return null;
  let path: string;
  try {
    // resolve against a dummy origin: a value that would leave this origin changes `origin`
    const url = new URL(raw, 'https://app.invalid');
    if (url.origin !== 'https://app.invalid') return null;
    path = url.pathname;
  } catch {
    return null;
  }
  return AUTH_PATHS.includes(path) ? null : raw;
}

/** `/login?next=…` for a protected page. */
export const loginFor = (next: string): string => `${paths.login}?next=${enc(next)}`;

/** Old (version 1) addresses that still resolve: they redirect to the canonical route above. */
export const LEGACY_REDIRECTS: ReadonlyArray<readonly [from: string, to: string]> = [
  ['/validators', paths.validators],
  ['/proposals', paths.proposals],
  ['/blocks', paths.blocks],
  ['/transactions', paths.transactions],
  ['/tokens', paths.tokens],
  ['/wallet/create-proposal', paths.createProposal],
  ['/visualizations/dev-activity', paths.developers],
  ['/visualizations/dominance', paths.dominance],
];
