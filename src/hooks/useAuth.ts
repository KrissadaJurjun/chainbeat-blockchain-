import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthError } from '@/services/auth/types';
import { useAuthStore } from '@/stores/authStore';

/** Turns whatever a flow threw into a message in the visitor's language. Unknown errors become the generic one. */
export function useAuthErrorMessage(): (error: unknown) => string {
  const { t } = useTranslation();
  return useCallback(
    (error: unknown): string => {
      if (!(error instanceof AuthError)) return t('auth.errors.generic');
      const seconds = Math.max(1, Math.ceil((error.detail.retryAfterMs ?? 0) / 1000));
      switch (error.code) {
        case 'locked':
        case 'rateLimited':
          return t(`auth.errors.${error.code}`, { count: seconds });
        case 'otpInvalid':
          return t('auth.errors.otpInvalid', { count: error.detail.attemptsLeft ?? 0 });
        default:
          return t(`auth.errors.${error.code}`);
      }
    },
    [t],
  );
}

/**
 * Keeps the sign-in state honest while the page is open: ends an expired session, and follows a sign-in or sign-out
 * made in another tab (localStorage `storage` events). Mounted once per layout.
 */
export function useAuthSessionWatcher(): void {
  useEffect(() => {
    const purge = (): void => useAuthStore.getState().purgeExpiredSession();
    purge();
    const interval = window.setInterval(purge, 30_000);
    const onStorage = (e: StorageEvent): void => {
      if (e.key === 'chainbeat.auth') void useAuthStore.persist.rehydrate();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', purge);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', purge);
    };
  }, []);
}
