import { useMemo, type ComponentType } from 'react';
import { Box, Coins, LayoutDashboard, ReceiptText, ShieldCheck, Vote, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ALL_PAGES } from '@/app/navigation';
import { useSearch } from '@/hooks/useChainData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { classifyQuery, type QueryInfo } from '@/lib/searchQuery';
import { useChain } from '@/stores/chainStore';
import type { SearchResultKind } from '@/types/domain';

export interface SearchOption {
  id: string;
  kind: SearchResultKind;
  label: string;
  hint?: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
}

export const KIND_ICONS: Record<SearchResultKind, ComponentType<{ className?: string }>> = {
  page: LayoutDashboard,
  block: Box,
  transaction: ReceiptText,
  address: Wallet,
  validator: ShieldCheck,
  proposal: Vote,
  token: Coins,
};

/** The order result categories are shown in. */
export const KIND_ORDER: readonly SearchResultKind[] = ['page', 'block', 'transaction', 'address', 'validator', 'proposal', 'token'];

export interface SearchOptionsResult {
  info: QueryInfo;
  options: SearchOption[];
  loading: boolean;
  /** A valid query that matched nothing. */
  empty: boolean;
  /** The entry cannot be a search term at all (bad checksum, wrong hash length …). */
  invalid: boolean;
}

/** Everything a search UI needs for one entry: classification, matching pages + data results (debounced), state flags. */
export function useSearchOptions(query: string): SearchOptionsResult {
  const { t } = useTranslation();
  const chain = useChain();
  const debounced = useDebouncedValue(query, 180);
  const info = useMemo(() => classifyQuery(query, chain.bech32Prefix), [query, chain.bech32Prefix]);
  const settled = debounced.trim() === query.trim();
  const search = useSearch(settled ? debounced : '');

  const options = useMemo<SearchOption[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q || info.kind === 'invalid') return [];
    const pages: SearchOption[] = ALL_PAGES.filter((p) => t(p.labelKey).toLowerCase().includes(q))
      .slice(0, 4)
      .map((p) => ({ id: 'page:' + p.id, kind: 'page', label: t(p.labelKey), href: p.to, icon: p.icon }));
    const entities: SearchOption[] = (settled ? (search.data ?? []) : []).map((r) => ({ ...r }));
    const all = [...pages, ...entities];
    return KIND_ORDER.flatMap((kind) => all.filter((o) => o.kind === kind));
  }, [query, info.kind, settled, search.data, t]);

  const trimmed = query.trim();
  const loading = trimmed.length > 0 && info.kind !== 'invalid' && (!settled || search.isFetching) && options.length === 0;
  return { info, options, loading, empty: trimmed.length > 0 && info.kind !== 'invalid' && !loading && options.length === 0, invalid: info.kind === 'invalid' };
}
