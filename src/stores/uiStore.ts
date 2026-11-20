import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/storage';

export type ThemePreference = 'system' | 'dark' | 'light';
export type MotionPreference = 'system' | 'reduce';
export type GlobalDialog = 'wallet' | 'demo' | 'search';
/** Layout density: `compact` tightens the content area. */
export type DensityPreference = 'comfortable' | 'compact';
/** How often live-looking data refreshes: about every block, every ~30 s, or only when asked. */
export type RefreshPreference = 'live' | 'slow' | 'manual';

interface UiState {
  theme: ThemePreference;
  motion: MotionPreference;
  density: DensityPreference;
  refresh: RefreshPreference;
  sidebarCollapsed: boolean;
  /** Section id → open? Missing keys default to open. */
  sectionsOpen: Record<string, boolean>;
  /** Favourite network ids (the gold stars in the Explorer list). */
  favorites: string[];
  /** Transient: mobile drawer state (not persisted). */
  mobileNavOpen: boolean;
  /** Transient: which global dialog is open (not persisted). Any page can open one via `openDialog`. */
  dialog: GlobalDialog | null;

  openDialog: (dialog: GlobalDialog) => void;
  closeDialog: () => void;
  setTheme: (theme: ThemePreference) => void;
  setMotion: (motion: MotionPreference) => void;
  setDensity: (density: DensityPreference) => void;
  setRefresh: (refresh: RefreshPreference) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSection: (id: string) => void;
  toggleFavorite: (chainId: string) => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      motion: 'system',
      density: 'comfortable',
      refresh: 'live',
      sidebarCollapsed: false,
      sectionsOpen: {},
      favorites: ['cosmoshub', 'osmosis'],
      mobileNavOpen: false,
      dialog: null,

      openDialog: (dialog) => set({ dialog }),
      closeDialog: () => set({ dialog: null }),
      setTheme: (theme) => set({ theme }),
      setMotion: (motion) => set({ motion }),
      setDensity: (density) => set({ density }),
      setRefresh: (refresh) => set({ refresh }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSection: (id) => set((s) => ({ sectionsOpen: { ...s.sectionsOpen, [id]: !(s.sectionsOpen[id] ?? true) } })),
      toggleFavorite: (chainId) =>
        set((s) => ({
          favorites: s.favorites.includes(chainId) ? s.favorites.filter((f) => f !== chainId) : [...s.favorites, chainId],
        })),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
    }),
    {
      name: 'chainbeat.ui',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        theme: s.theme,
        motion: s.motion,
        density: s.density,
        refresh: s.refresh,
        sidebarCollapsed: s.sidebarCollapsed,
        sectionsOpen: s.sectionsOpen,
        favorites: s.favorites,
      }),
    },
  ),
);
