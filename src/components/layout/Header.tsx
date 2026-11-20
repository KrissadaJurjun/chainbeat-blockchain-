import { useEffect } from 'react';
import { FlaskConical, Menu, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/brand/Logo';
import { Tip } from '@/components/ui/Tooltip';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useChain } from '@/stores/chainStore';
import { useUiStore } from '@/stores/uiStore';
import { LanguageSelector } from './LanguageSelector';
import { NotificationsMenu } from './NotificationsMenu';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { MobileNav } from './Sidebar';
import { ThemeSelector } from './ThemeSelector';
import { TopNav } from './TopNav';
import { UserMenu } from './UserMenu';
import { WalletButton } from './WalletButton';

const iconButton =
  'grid size-9 shrink-0 place-items-center rounded-[10px] text-fg-2 outline-none transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-cyan/40';

/** Network / mode indicator. Always tells the user that data is simulated, and opens the demo controls. */
function DemoChip() {
  const { t } = useTranslation();
  const chain = useChain();
  const openDialog = useUiStore((s) => s.openDialog);
  return (
    <Tip label={t('demo.chipTip')}>
      <button
        type="button"
        onClick={() => openDialog('demo')}
        aria-label={`${t('demo.mode')} · ${chain.shortName}`}
        className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-yellow/30 bg-yellow/10 px-2.5 text-[12px] font-semibold text-yellow outline-none transition-colors hover:bg-yellow/18 focus-visible:ring-2 focus-visible:ring-cyan/40"
      >
        <FlaskConical className="size-4" aria-hidden />
        <span className="hidden whitespace-nowrap 2xl:inline">
          {t('demo.mode')} · <span className="font-medium text-fg-2">{chain.shortName}</span>
        </span>
        <span className="hidden whitespace-nowrap md:inline 2xl:hidden">{t('common.demo')}</span>
      </button>
    </Tip>
  );
}

export function Header() {
  const { t } = useTranslation();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const openDialog = useUiStore((s) => s.openDialog);
  const inlineSearch = useMediaQuery('(min-width: 1280px)');

  // Ctrl/Cmd + K always opens the search palette. "/" focuses the inline field when it is visible, otherwise opens the palette too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openDialog('search');
        return;
      }
      if (inlineSearch) return;
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openDialog('search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inlineSearch, openDialog]);

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-header px-3 sm:gap-3 sm:px-4 lg:static lg:ps-5 lg:pe-3">
      {/* left cluster */}
      <MobileNav
        trigger={
          <button type="button" aria-label={t('navigation.openMenu')} className={`${iconButton} lg:hidden`}>
            <Menu className="size-5" aria-hidden />
          </button>
        }
      />
      <Link to="/" aria-label={t('navigation.home')} className="inline-flex shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan/40">
        {/* the wordmark needs ~450px of header once a wallet chip is connected; below that the mark alone is shown */}
        <Logo className="[&>span:last-child]:max-[451px]:hidden" />
      </Link>
      <Tip label={collapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')}>
        <button
          type="button"
          aria-label={collapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')}
          aria-pressed={collapsed}
          onClick={toggleSidebar}
          className={`${iconButton} hidden lg:grid`}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}
        </button>
      </Tip>
      <GlobalSearch hotkey={inlineSearch} className="hidden w-[226px] shrink-0 xl:block 2xl:w-[260px]" />

      {/* centre: page tabs (full pills from xl, a compact dropdown from lg) */}
      <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
        <TopNav />
      </div>

      {/* right cluster */}
      <div className="ms-auto flex shrink-0 items-center gap-0.5 sm:gap-1 lg:ms-0">
        <Tip label={t('search.label')}>
          <button type="button" aria-label={t('search.label')} onClick={() => openDialog('search')} className={`${iconButton} xl:hidden`}>
            <Search className="size-[18px]" aria-hidden />
          </button>
        </Tip>
        <DemoChip />
        <div className="hidden items-center sm:flex">
          <LanguageSelector />
          <ThemeSelector />
        </div>
        <NotificationsMenu />
        <div className="ms-1 sm:ms-1.5">
          <WalletButton />
        </div>
        <div className="ms-1">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
