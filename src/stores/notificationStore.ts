import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/storage';
import { uid } from '@/lib/utils';
import type { AppNotification } from '@/types/domain';

const MAX_LOCAL = 50;
const MAX_IDS = 300;
const cap = (ids: string[]): string[] => ids.slice(-MAX_IDS);

interface NotificationState {
  /** Ids the user has opened or marked as read (feed items and local events alike). */
  readIds: string[];
  /** Feed items the user removed from the list. */
  dismissedIds: string[];
  /** Things that happened in this browser (wallet, simulated transactions, network switches, warnings), newest first. */
  local: AppNotification[];
  push: (n: Omit<AppNotification, 'id'>) => void;
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  dismiss: (id: string) => void;
  dismissAll: (ids: string[]) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      readIds: [],
      dismissedIds: [],
      local: [],
      push: (n) => set((s) => ({ local: [{ ...n, id: uid('n') }, ...s.local].slice(0, MAX_LOCAL) })),
      markRead: (id) => set((s) => (s.readIds.includes(id) ? s : { readIds: cap([...s.readIds, id]) })),
      markAllRead: (ids) => set((s) => ({ readIds: cap(Array.from(new Set([...s.readIds, ...ids]))) })),
      dismiss: (id) => set((s) => ({ local: s.local.filter((n) => n.id !== id), dismissedIds: cap(Array.from(new Set([...s.dismissedIds, id]))) })),
      dismissAll: (ids) => set((s) => ({ local: s.local.filter((n) => !ids.includes(n.id)), dismissedIds: cap(Array.from(new Set([...s.dismissedIds, ...ids]))) })),
    }),
    {
      name: 'chainbeat.notifications',
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      // version 1 only stored `readIds`
      migrate: (persisted) => ({ readIds: [], ...(persisted as object), dismissedIds: [], local: [] }) as unknown as NotificationState,
    },
  ),
);
