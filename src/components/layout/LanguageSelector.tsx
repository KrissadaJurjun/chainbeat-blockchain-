import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, Globe, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Menu';
import { Tip } from '@/components/ui/Tooltip';
import { setLanguage } from '@/i18n';
import { availableLanguages, getLanguage } from '@/i18n/languages';
import { cn } from '@/lib/utils';

/** Searchable list of every shipped language. Names are shown in their own script. */
export function LanguageList({ onSelected, autoFocus = true, wide }: { onSelected?: () => void; autoFocus?: boolean; wide?: boolean }) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const current = getLanguage(i18n.language).code;

  // Arrow keys move through the languages (from the search field into the list and back); Home/End jump to the ends.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const buttons = Array.from(listRef.current?.querySelectorAll('button') ?? []);
    if (buttons.length === 0) return;
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowUp' && at <= 0) {
      if (at === 0) {
        e.preventDefault();
        (e.currentTarget.querySelector('input[type=search]') as HTMLElement | null)?.focus();
      }
      return;
    }
    if ((e.key === 'Home' || e.key === 'End') && at < 0) return; // leave Home/End alone inside the search field
    const target = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : e.key === 'ArrowDown' ? Math.min(buttons.length - 1, at + 1) : at - 1;
    e.preventDefault();
    buttons[target]?.focus();
  };

  const items = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return availableLanguages.filter((l) => !q || l.name.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
  }, [filter]);

  return (
    <div onKeyDown={onKeyDown}>
      {availableLanguages.length > 8 ? (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus={autoFocus}
            placeholder={t('language.search')}
            aria-label={t('language.search')}
            className="h-9 w-full rounded-lg border border-line-strong bg-card/60 ps-9 pe-3 text-[13px] text-fg outline-none placeholder:text-fg-3 focus-visible:border-cyan focus-visible:ring-2 focus-visible:ring-cyan/30"
          />
        </div>
      ) : null}
      <ul ref={listRef} className={cn('overflow-y-auto', wide ? 'grid max-h-[420px] gap-x-2 sm:grid-cols-2 lg:grid-cols-3' : 'max-h-[300px]')} aria-label={t('language.label')}>
        {items.map((l) => {
          const selected = l.code === current;
          return (
            <li key={l.code}>
              <button
                type="button"
                lang={l.code}
                aria-current={selected || undefined}
                onClick={() => {
                  void setLanguage(l.code);
                  onSelected?.();
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-start text-[13px] text-fg-2 transition-colors hover:bg-hover hover:text-fg',
                  selected && 'bg-active/60 text-fg',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{l.nativeName}</span>
                  <span className="block truncate text-[11.5px] text-fg-3" lang="en">
                    {l.name}
                  </span>
                </span>
                {selected ? <Check className="size-4 shrink-0 text-cyan" aria-hidden /> : <span className="shrink-0 text-[11px] uppercase text-fg-3">{l.code}</span>}
              </button>
            </li>
          );
        })}
        {items.length === 0 ? <li className="px-3 py-4 text-[12.5px] text-fg-3">{t('search.noResults', { query: filter })}</li> : null}
      </ul>
    </div>
  );
}

export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = getLanguage(i18n.language);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label={t('language.label')}>
        <PopoverTrigger
          aria-label={`${t('language.label')}: ${current.nativeName} (${current.code.split('-')[0]})`}
          className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-transparent px-2.5 text-[12px] font-semibold uppercase text-fg-2 outline-none transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-cyan/40 data-[state=open]:bg-hover"
        >
          <Globe className="size-[17px]" aria-hidden />
          <span className="hidden 2xl:inline" lang={current.code}>
            {current.code.split('-')[0]}
          </span>
        </PopoverTrigger>
      </Tip>
      <PopoverContent className="w-[290px] p-2.5" align="end">
        <p className="px-1.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-3">{t('language.label')}</p>
        <LanguageList onSelected={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
