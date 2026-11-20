import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/storage';
import type { SearchResultKind } from '@/types/domain';

export interface RecentSearch {
  /** What the user typed. */
  query: string;
  /** What they picked (a block number, a validator name …). */
  label: string;
  href: string;
  kind: SearchResultKind;
}

const MAX_RECENT = 8;

interface SearchState {
  recent: RecentSearch[];
  add: (item: RecentSearch) => void;
  remove: (href: string) => void;
  clear: () => void;
}

/** Recent searches live only in this browser (localStorage); clearing them is one click. */
export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      recent: [],
      add: (item) => set((s) => ({ recent: [item, ...s.recent.filter((r) => r.href !== item.href)].slice(0, MAX_RECENT) })),
      remove: (href) => set((s) => ({ recent: s.recent.filter((r) => r.href !== href) })),
      clear: () => set({ recent: [] }),
    }),
    { name: 'chainbeat.search', version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
);
