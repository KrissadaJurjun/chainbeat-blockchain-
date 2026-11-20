import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { History, LoaderCircle, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useChain } from '@/stores/chainStore';
import { useSearchStore } from '@/stores/searchStore';
import { KIND_ICONS, useSearchOptions, type SearchOption } from './useSearchOptions';

interface GlobalSearchProps {
  className?: string;
  /** `dropdown` floats the results under the field; `inline` renders them in normal flow (dialogs, the Explorer page). */
  variant?: 'dropdown' | 'inline';
  autoFocus?: boolean;
  onDone?: () => void;
  /** Register the "/" shortcut. Only one instance should do this. */
  hotkey?: boolean;
  /** Taller field with larger type, for the Explorer landing page. */
  large?: boolean;
}

/**
 * Global search: pages, blocks (height or hash), transactions (hash), addresses, validators, proposals and tokens on
 * the selected network. ARIA combobox: arrow keys move, Enter opens, Escape clears then closes. Remembers recent
 * searches (this browser only).
 */
export function GlobalSearch({ className, variant = 'dropdown', autoFocus, onDone, hotkey, large }: GlobalSearchProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const chain = useChain();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const recent = useSearchStore((s) => s.recent);
  const addRecent = useSearchStore((s) => s.add);
  const clearRecent = useSearchStore((s) => s.clear);
  const removeRecent = useSearchStore((s) => s.remove);
  const { info, options, loading, empty, invalid } = useSearchOptions(query);

  const trimmed = query.trim();
  const showRecent = trimmed === '' && recent.length > 0;
  const rows: SearchOption[] = useMemo(
    () => (showRecent ? recent.map((r) => ({ id: 'recent:' + r.href, kind: r.kind, label: r.label, hint: r.query, href: r.href })) : options),
    [showRecent, recent, options],
  );
  const open = (variant === 'inline' || focused) && (trimmed !== '' || recent.length > 0 || variant === 'inline');

  useEffect(() => setActive(0), [rows.length, query]);

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkey]);

  const go = (option: SearchOption): void => {
    if (trimmed && option.kind !== 'page') addRecent({ query: trimmed, label: option.label, href: option.href, kind: option.kind });
    navigate(option.href);
    setQuery('');
    setFocused(false);
    inputRef.current?.blur();
    onDone?.();
  };

  const submit = (): void => {
    const option = rows[active] ?? rows[0];
    if (option) go(option);
    else inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown' && rows.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % rows.length);
    } else if (e.key === 'ArrowUp' && rows.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + rows.length) % rows.length);
    } else if (e.key === 'Home' && rows.length && e.ctrlKey) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && rows.length && e.ctrlKey) {
      e.preventDefault();
      setActive(rows.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      if (query) {
        e.preventDefault();
        e.stopPropagation();
        setQuery('');
      } else {
        setFocused(false);
        inputRef.current?.blur();
      }
    }
  };

  const invalidMessage = invalid ? t('search.invalid.' + (info.reason ?? 'badChars'), { prefix: chain.bech32Prefix }) : '';
  // the invalid / no-results messages are announced by their own live regions; this one covers progress and result counts
  const announce = loading ? t('search.searching') : trimmed && options.length > 0 ? t('search.resultCount', { count: options.length }) : '';

  const heading = (kind: SearchOption['kind']): string => t('search.categories.' + kind);

  const listbox = open ? (
    <div className={cn(variant === 'dropdown' ? 'glass-pop cb-pop absolute inset-x-0 top-[calc(100%+8px)] z-[70] max-h-[400px] overflow-y-auto rounded-xl p-1.5' : 'mt-3')}>
      {showRecent ? (
        <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-3">{t('search.recent')}</p>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={clearRecent} className="rounded px-1.5 py-0.5 text-[11.5px] text-fg-3 hover:bg-hover hover:text-fg">
            {t('search.clearRecent')}
          </button>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <ul id={listId} role="listbox" aria-label={showRecent ? t('search.recent') : t('search.results')}>
          {rows.map((o, i) => {
            const Icon = showRecent ? History : (o.icon ?? KIND_ICONS[o.kind]);
            const startsGroup = !showRecent && (i === 0 || rows[i - 1]?.kind !== o.kind);
            return (
              <Fragment key={o.id}>
                {startsGroup ? (
                  <li role="presentation" className="px-2.5 pb-0.5 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-fg-3">
                    {heading(o.kind)}
                  </li>
                ) : null}
                <li
                  id={listId + '-' + i}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(o);
                  }}
                  className={cn('group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-fg-2', i === active && 'bg-hover text-fg')}
                >
                  <Icon className="size-4 shrink-0 text-fg-3" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="ltr-isolate">{o.label}</span>
                    {o.hint ? <span className="ms-2 text-[11.5px] text-fg-3">{o.hint}</span> : null}
                  </span>
                  {showRecent ? (
                    <button
                      type="button"
                      aria-label={t('search.removeRecent', { query: o.label })}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeRecent(o.href);
                      }}
                      className="grid size-6 shrink-0 place-items-center rounded-md text-fg-3 hover:bg-card hover:text-fg"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide text-fg-3">{t('search.kinds.' + o.kind)}</span>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ul>
      ) : null}
      {trimmed === '' && !showRecent ? <p className="px-3 py-3 text-[12.5px] leading-relaxed text-fg-3">{t('search.hint', { prefix: chain.bech32Prefix })}</p> : null}
      {loading ? (
        <p className="flex items-center gap-2 px-3 py-3 text-[12.5px] text-fg-3">
          <LoaderCircle className="size-4 animate-spin-slow" aria-hidden /> {t('search.searching')}
        </p>
      ) : null}
      {invalid ? (
        <p role="alert" className="px-3 py-3 text-[12.5px] leading-relaxed text-red">
          {invalidMessage}
        </p>
      ) : null}
      {empty ? (
        <p role="status" className="px-3 py-3 text-[12.5px] text-fg-3">
          {t('search.noResults', { query: trimmed })}
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={t('search.label')}
          aria-expanded={open && rows.length > 0}
          aria-controls={rows.length > 0 ? listId : undefined}
          aria-activedescendant={open && rows.length > 0 ? listId + '-' + active : undefined}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={query}
          placeholder={t('search.placeholder')}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          className={cn(
            'w-full rounded-[11px] border border-line bg-header py-0 ps-3.5 text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 hover:border-line-strong focus-visible:border-cyan focus-visible:ring-2 focus-visible:ring-cyan/30 aria-[invalid=true]:border-red',
            large ? 'h-12 text-[14.5px]' : 'h-[38px] text-[13px]',
            query || loading ? 'pe-[84px]' : 'pe-11',
          )}
        />
        <div className="absolute inset-y-0 end-1.5 flex items-center gap-0.5">
          {loading ? <LoaderCircle className="me-1 size-4 animate-spin-slow text-fg-3" aria-hidden /> : null}
          {query ? (
            <button
              type="button"
              aria-label={t('common.clear')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-hover hover:text-fg"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={t('search.submit')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={submit}
            className="grid size-8 place-items-center rounded-md text-fg-2 transition-colors hover:bg-hover hover:text-fg"
          >
            <Search className="size-[17px]" aria-hidden />
          </button>
        </div>
      </div>
      {listbox}
      <p role="status" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
