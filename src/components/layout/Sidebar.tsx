import type { ReactElement, ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronDown, Star, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChainGem, Logo } from '@/components/brand/Logo';
import { Tip } from '@/components/ui/Tooltip';
import { NAV_SECTIONS, TOP_NAV, type NavItem } from '@/app/navigation';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { SELECTABLE_CHAINS } from '@/services/chain/registry';
import { useChainStore } from '@/stores/chainStore';
import { useUiStore } from '@/stores/uiStore';
import { useEffect } from 'react';
import type { ChainConfig } from '@/types/domain';

interface ContentProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

function NavSection({ id, label, collapsed, first, children }: { id: string; label: string; collapsed: boolean; first?: boolean; children: ReactNode }) {
  const open = useUiStore((s) => s.sectionsOpen[id] ?? true);
  const toggle = useUiStore((s) => s.toggleSection);
  const panelId = `nav-section-${id}`;
  const expanded = collapsed || open;
  return (
    <div className={cn(!first && 'mt-1.5 border-t border-line pt-2')}>
      {collapsed ? null : (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => toggle(id)}
          className="flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-[12px] font-semibold uppercase tracking-[0.09em] text-fg-2 transition-colors hover:text-fg"
        >
          <span>{label}</span>
          <ChevronDown className={cn('size-3.5 text-fg-3 transition-transform duration-200', !open && '-rotate-90 rtl:rotate-90')} aria-hidden />
        </button>
      )}
      {/* grid-rows trick: animates height without measuring; `inert` keeps collapsed links out of the tab order */}
      <div id={panelId} className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }} inert={!expanded}>
        {/* visibility (delayed until the height animation ends) removes collapsed links from view AND the accessibility tree */}
        <ul
          className="flex min-h-0 flex-col gap-0.5 overflow-hidden"
          style={{ visibility: expanded ? 'visible' : 'hidden', transition: 'visibility 0s linear ' + (expanded ? '0ms' : '200ms') }}
        >
          {children}
        </ul>
      </div>
    </div>
  );
}

function SidebarLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const label = t(item.labelKey);
  const Icon = item.icon;
  return (
    <li>
      <Tip label={label} side="right" disabled={!collapsed}>
        <NavLink
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          aria-label={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'flex h-[34px] items-center gap-2.5 rounded-[9px] border border-transparent px-2.5 text-[13px] text-fg-2 transition-colors duration-150 hover:bg-hover hover:text-fg [@media(max-height:960px)]:h-[31px]',
              isActive && 'border-active-line bg-active text-fg',
              collapsed && 'justify-center px-0',
            )
          }
        >
          <Icon className="size-[15px] shrink-0" aria-hidden />
          {collapsed ? null : <span className="truncate">{label}</span>}
        </NavLink>
      </Tip>
    </li>
  );
}

function ChainRow({ chain, collapsed, onNavigate }: { chain: ChainConfig; collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const selected = useChainStore((s) => s.chainId === chain.id);
  const setChain = useChainStore((s) => s.setChain);
  const favorite = useUiStore((s) => s.favorites.includes(chain.id));
  const toggleFavorite = useUiStore((s) => s.toggleFavorite);

  return (
    <li>
      <div className={cn('flex items-center rounded-[9px] border border-transparent transition-colors', selected && 'border-active-line bg-active')}>
        <Tip label={chain.name} side="right" disabled={!collapsed}>
          <button
            type="button"
            aria-pressed={selected}
            aria-label={collapsed ? chain.name : undefined}
            onClick={() => {
              setChain(chain.id);
              onNavigate?.();
            }}
            className={cn(
              'flex h-[34px] min-w-0 flex-1 items-center gap-2.5 rounded-[9px] px-2.5 text-[13px] font-medium text-fg-2 transition-colors hover:text-fg [@media(max-height:960px)]:h-[31px]',
              !selected && 'hover:bg-hover',
              selected && 'text-fg',
              collapsed && 'justify-center px-0',
            )}
          >
            <ChainGem gradient={chain.gradient} />
            {collapsed ? null : <span className="truncate">{chain.name}</span>}
            {collapsed ? null : (
              <Tip label={t('chains.simulatedHealthy')} side="top">
                <span className="ms-auto size-1.5 shrink-0 rounded-full bg-green shadow-[0_0_6px_var(--c-green)]" aria-label={t('chains.simulatedHealthy')} role="img" />
              </Tip>
            )}
          </button>
        </Tip>
        {collapsed ? null : (
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? t('chains.unfavorite', { name: chain.name }) : t('chains.favorite', { name: chain.name })}
            onClick={() => toggleFavorite(chain.id)}
            className="me-1 grid size-7 shrink-0 place-items-center rounded-md text-fg-3 transition-colors hover:bg-hover"
          >
            <Star className={cn('size-3.5', favorite && 'fill-amber text-amber')} aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}

/** The navigation tree. Used by the desktop sidebar (collapsible) and the mobile drawer. */
export function SidebarContent({ collapsed, onNavigate }: ContentProps) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('navigation.sidebar')}
      className={cn(
        'flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden pb-8 pt-3',
        // fade the bottom edge so it is obvious the list scrolls when the viewport is short
        '[mask-image:linear-gradient(to_bottom,#000_calc(100%-26px),transparent)]',
        collapsed ? 'px-2.5' : 'px-3',
      )}
    >
      <NavSection id="explorer" label={t('sections.explorer')} collapsed={collapsed} first>
        {SELECTABLE_CHAINS.map((chain) => (
          <ChainRow key={chain.id} chain={chain} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </NavSection>
      {NAV_SECTIONS.map((section) => (
        <NavSection key={section.id} id={section.id} label={t(section.labelKey)} collapsed={collapsed}>
          {section.items.map((item) => (
            <SidebarLink key={item.id} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </NavSection>
      ))}
    </nav>
  );
}

/** Permanent desktop sidebar (≥ lg). Collapses to an icon rail; the choice is persisted. */
export function DesktopSidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'hidden shrink-0 border-e border-line bg-sidebar transition-[width] duration-200 ease-out lg:block',
        collapsed ? 'w-[68px]' : 'w-[220px]',
      )}
    >
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}

/** Off-canvas navigation for < lg. A Radix dialog gives focus trapping, Escape-to-close and focus return. */
export function MobileNav({ trigger }: { trigger: ReactElement }) {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNavOpen);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (isDesktop && open) setOpen(false);
  }, [isDesktop, open, setOpen]);

  return (
    <DialogPrimitive.Root open={open && !isDesktop} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="cb-overlay fixed inset-0 z-[80] bg-[var(--c-overlay)] backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="cb-drawer fixed inset-y-0 start-0 z-[81] flex w-[min(300px,86vw)] flex-col border-e border-line-strong bg-sidebar shadow-2xl"
        >
          <div className="flex h-[64px] shrink-0 items-center justify-between border-b border-line px-4">
            <DialogPrimitive.Title className="sr-only">{t('navigation.menu')}</DialogPrimitive.Title>
            <Logo />
            <DialogPrimitive.Close
              aria-label={t('navigation.closeMenu')}
              className="grid size-9 place-items-center rounded-lg text-fg-2 transition-colors hover:bg-hover hover:text-fg"
            >
              <X className="size-[18px]" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-line px-3.5 pb-3 pt-3.5">
              <p className="px-2.5 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.09em] text-fg-2">{t('navigation.pages')}</p>
              <ul className="flex flex-col gap-0.5">
                {TOP_NAV.map((item) => (
                  <SidebarLink key={item.id} item={item} collapsed={false} onNavigate={() => setOpen(false)} />
                ))}
              </ul>
            </div>
            <SidebarContent collapsed={false} onNavigate={() => setOpen(false)} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
