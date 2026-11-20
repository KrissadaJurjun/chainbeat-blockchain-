import { useSyncExternalStore } from 'react';

/** Subscribe to a CSS media query. Returns `false` where matchMedia is unavailable (SSR / some test envs). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** True at Tailwind's `lg` breakpoint and above (the desktop shell with a permanent sidebar). */
export const useIsDesktop = (): boolean => useMediaQuery('(min-width: 1024px)');
