import { useTranslation } from 'react-i18next';
import { LogoMark } from '@/components/brand/Logo';

/**
 * Shown by the router while the first (lazy) route module is being fetched. React Router warns if no
 * fallback exists, and without one the user would stare at an empty page.
 */
export function BootFallback() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="grid min-h-dvh place-items-center bg-canvas">
      <LogoMark className="size-14 animate-pulse-soft" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}
