import {
  ArrowLeftRight,
  Boxes,
  ChartLine,
  ChartPie,
  ChartScatter,
  Coins,
  Crown,
  Activity,
  Droplets,
  FilePlus2,
  Gavel,
  GitBranch,
  Globe,
  Info,
  Landmark,
  Layers,
  LayoutDashboard,
  LogIn,
  Network,
  ReceiptText,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  UserPlus,
  UserRound,
  Vote,
  Box,
  type LucideIcon,
} from 'lucide-react';
import { paths } from '@/lib/paths';

export interface NavItem {
  id: string;
  to: string;
  /** i18n key for the label. */
  labelKey: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavSection {
  id: string;
  labelKey: string;
  items: NavItem[];
}

/** Primary tabs in the header (and the first group of the mobile drawer). */
export const TOP_NAV: readonly NavItem[] = [
  { id: 'dashboard', to: paths.home, labelKey: 'navigation.dashboard', icon: LayoutDashboard, end: true },
  { id: 'validators', to: paths.validators, labelKey: 'navigation.validators', icon: ShieldCheck },
  { id: 'proposals', to: paths.proposals, labelKey: 'navigation.proposals', icon: Vote },
  { id: 'blocks', to: paths.blocks, labelKey: 'navigation.blocks', icon: Boxes },
  { id: 'transactions', to: paths.transactions, labelKey: 'navigation.transactions', icon: ArrowLeftRight },
];

/** Sidebar groups below the Explorer (network) list. */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: 'wallet',
    labelKey: 'sections.wallet',
    items: [
      { id: 'portfolio', to: paths.portfolio, labelKey: 'navigation.portfolio', icon: ChartPie },
      { id: 'swap', to: paths.swap, labelKey: 'navigation.swap', icon: ArrowLeftRight },
      { id: 'stake', to: paths.stake, labelKey: 'navigation.stake', icon: Layers },
      { id: 'liquid-staking', to: paths.liquidStaking, labelKey: 'navigation.liquidStaking', icon: Droplets },
      { id: 'send', to: paths.send, labelKey: 'navigation.send', icon: Send },
      { id: 'vote', to: paths.vote, labelKey: 'navigation.vote', icon: Vote },
      { id: 'create-proposal', to: paths.createProposal, labelKey: 'navigation.createProposal', icon: FilePlus2 },
    ],
  },
  {
    id: 'analytics',
    labelKey: 'sections.analytics',
    items: [
      { id: 'market', to: paths.market, labelKey: 'navigation.market', icon: ChartLine },
      { id: 'network', to: paths.network, labelKey: 'navigation.network', icon: Network },
      { id: 'governance', to: paths.governanceAnalytics, labelKey: 'navigation.governance', icon: Landmark },
    ],
  },
  {
    id: 'visualizations',
    labelKey: 'sections.visualizations',
    items: [
      { id: 'ibc', to: paths.ibc, labelKey: 'navigation.ibcNetwork', icon: Share2 },
      { id: 'dev-activity', to: paths.developers, labelKey: 'navigation.devActivity', icon: GitBranch },
      { id: 'multichain', to: paths.multichain, labelKey: 'navigation.multichain', icon: Globe },
      { id: 'heartbeat', to: paths.heartbeat, labelKey: 'navigation.heartbeat', icon: Activity },
      { id: 'dominance', to: paths.dominance, labelKey: 'navigation.dominance', icon: Crown },
      { id: 'validators-viz', to: paths.validatorsViz, labelKey: 'navigation.validatorsViz', icon: ChartScatter },
      { id: 'explorer-home', to: paths.explorer, labelKey: 'navigation.explorerHome', icon: Search, end: true },
      { id: 'block-explorer', to: paths.blocks, labelKey: 'navigation.blockExplorer', icon: Box },
      { id: 'tx-explorer', to: paths.transactions, labelKey: 'navigation.transactionExplorer', icon: ReceiptText },
      { id: 'token-explorer', to: paths.tokens, labelKey: 'navigation.tokenExplorer', icon: Coins },
      { id: 'governance-home', to: paths.governance, labelKey: 'navigation.governanceHome', icon: Gavel, end: true },
    ],
  },
];

/** Pages that are not in the sidebar but should still be found by search. */
const EXTRA_PAGES: readonly NavItem[] = [
  { id: 'settings', to: paths.settings, labelKey: 'navigation.settings', icon: Settings },
  { id: 'about', to: paths.about, labelKey: 'navigation.about', icon: Info },
  { id: 'login', to: paths.login, labelKey: 'auth.menu.signIn', icon: LogIn },
  { id: 'register', to: paths.register, labelKey: 'auth.menu.register', icon: UserPlus },
  { id: 'account', to: paths.myAccount, labelKey: 'auth.menu.account', icon: UserRound },
];

/** Flat list of every navigable page (used by the header search). */
export const ALL_PAGES: readonly NavItem[] = [...TOP_NAV, ...NAV_SECTIONS.flatMap((s) => s.items), ...EXTRA_PAGES].filter(
  (item, index, all) => all.findIndex((x) => x.to === item.to) === index,
);
