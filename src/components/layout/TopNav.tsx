import { ChevronDown } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TOP_NAV } from '@/app/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/Menu';
import { cn } from '@/lib/utils';

/** Header tabs. Full pills from `xl`; a compact dropdown below that so nothing is ever clipped. */
export function TopNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const current = TOP_NAV.find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));

  return (
    <>
      <nav aria-label={t('navigation.primary')} className="hidden items-center gap-1 xl:flex">
        {TOP_NAV.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'inline-flex h-[34px] items-center rounded-[10px] border border-transparent px-2.5 text-[13px] font-medium text-fg-3 transition-colors duration-150 hover:text-fg 2xl:px-4',
                isActive && 'border-line-strong bg-card-hi/70 text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]',
              )
            }
          >
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="xl:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line-strong bg-card-hi/50 px-3 text-[13px] font-medium text-fg outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-cyan/40"
            aria-label={t('navigation.primary')}
          >
            {current ? t(current.labelKey) : t('navigation.pages')}
            <ChevronDown className="size-3.5 text-fg-3" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[210px]">
            {TOP_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem key={item.id} asChild>
                  <NavLink to={item.to} end={item.end} className={({ isActive }) => cn(isActive && 'text-fg')}>
                    <Icon className="size-4 text-fg-3" aria-hidden />
                    {t(item.labelKey)}
                  </NavLink>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
