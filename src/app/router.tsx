import type { ComponentType } from 'react';
import { Navigate, createBrowserRouter, type RouteObject } from 'react-router-dom';
import { Redirect } from '@/app/Redirect';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AppShell } from '@/components/layout/AppShell';
import { LEGACY_REDIRECTS, paths } from '@/lib/paths';
import { BootFallback } from '@/pages/BootFallback';
import { RouteError } from '@/pages/RouteError';

/** Code-split every page: each route loads its own chunk on first visit. */
const page = (load: () => Promise<{ default: ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load()).default }),
});


export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    HydrateFallback: BootFallback,
    errorElement: <RouteError />,
    children: [
      { index: true, ...page(() => import('@/pages/DashboardPage')) },
      { path: 'dashboard', element: <Navigate to={paths.home} replace /> },

      // explorer
      { path: 'explorer', ...page(() => import('@/pages/ExplorerPage')) },
      { path: 'explorer/blocks', ...page(() => import('@/pages/BlocksPage')) },
      { path: 'explorer/blocks/:height', ...page(() => import('@/pages/BlockDetailPage')) },
      { path: 'explorer/transactions', ...page(() => import('@/pages/TransactionsPage')) },
      { path: 'explorer/transactions/:hash', ...page(() => import('@/pages/TransactionDetailPage')) },
      { path: 'explorer/accounts/:address', ...page(() => import('@/pages/AccountPage')) },
      { path: 'explorer/validators', ...page(() => import('@/pages/ValidatorsPage')) },
      { path: 'explorer/validators/:address', ...page(() => import('@/pages/ValidatorDetailPage')) },
      { path: 'explorer/tokens', ...page(() => import('@/pages/TokensPage')) },

      // wallet (Demo wallet workflows)
      { path: 'wallet', element: <Navigate to={paths.portfolio} replace /> },
      { path: 'wallet/portfolio', ...page(() => import('@/pages/PortfolioPage')) },
      { path: 'wallet/swap', ...page(() => import('@/pages/SwapPage')) },
      { path: 'wallet/stake', ...page(() => import('@/pages/StakePage')) },
      { path: 'wallet/liquid-staking', ...page(() => import('@/pages/LiquidStakingPage')) },
      { path: 'wallet/send', ...page(() => import('@/pages/SendPage')) },
      { path: 'wallet/vote', ...page(() => import('@/pages/VotePage')) },

      // governance
      { path: 'governance', ...page(() => import('@/pages/GovernanceHomePage')) },
      { path: 'governance/proposals', ...page(() => import('@/pages/ProposalsPage')) },
      { path: 'governance/proposals/:id', ...page(() => import('@/pages/ProposalDetailPage')) },
      { path: 'governance/create', ...page(() => import('@/pages/CreateProposalPage')) },

      // analytics
      { path: 'analytics/market', ...page(() => import('@/pages/MarketPage')) },
      { path: 'analytics/network', ...page(() => import('@/pages/NetworkPage')) },
      { path: 'analytics/governance', ...page(() => import('@/pages/GovernanceAnalyticsPage')) },
      { path: 'analytics/developers', ...page(() => import('@/pages/DevActivityPage')) },
      { path: 'analytics/dominance', ...page(() => import('@/pages/DominancePage')) },

      // visualizations
      { path: 'visualizations/ibc', ...page(() => import('@/pages/IbcPage')) },
      { path: 'visualizations/multichain', ...page(() => import('@/pages/MultichainPage')) },
      { path: 'visualizations/heartbeat', ...page(() => import('@/pages/HeartbeatPage')) },
      { path: 'visualizations/validators', ...page(() => import('@/pages/ValidatorsVizPage')) },

      { path: 'settings', ...page(() => import('@/pages/SettingsPage')) },
      { path: 'about', ...page(() => import('@/pages/AboutPage')) },
      // optional demo account (the sign-in pages themselves live in the lighter layout below)
      { path: 'account', ...page(() => import('@/pages/MyAccountPage')) },

      // addresses from version 1 keep working
      ...LEGACY_REDIRECTS.map(([from, to]): RouteObject => ({ path: from.slice(1), element: <Redirect to={to} /> })),
      { path: 'blocks/:height', element: <Redirect to="/explorer/blocks/:height" /> },
      { path: 'transactions/:hash', element: <Redirect to="/explorer/transactions/:hash" /> },

      { path: '*', ...page(() => import('@/pages/NotFoundPage')) },
    ],
  },
  // Demo sign-in pages: a slim frame (language and theme pickers, no sidebar). Static paths outrank the shell's `*`.
  {
    element: <AuthLayout />,
    HydrateFallback: BootFallback,
    errorElement: <RouteError />,
    children: [
      { path: 'login', ...page(() => import('@/pages/LoginPage')) },
      { path: 'register', ...page(() => import('@/pages/RegisterPage')) },
      { path: 'forgot-username', ...page(() => import('@/pages/ForgotUsernamePage')) },
      { path: 'forgot-password', ...page(() => import('@/pages/ForgotPasswordPage')) },
    ],
  },
];

export const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL });
