import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/brand/Logo';
import { LanguageSelector } from '@/components/layout/LanguageSelector';
import { RouteAnnouncer } from '@/components/layout/AppShell';
import { ThemeSelector, useApplyAppearance } from '@/components/layout/ThemeSelector';
import { Skeleton } from '@/components/ui/Feedback';
import { Toaster } from '@/components/ui/Toaster';
import { APP_VERSION } from '@/config/env';
import { useAuthSessionWatcher } from '@/hooks/useAuth';
import { paths } from '@/lib/paths';

function AuthFallback() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto w-full max-w-[440px] space-y-3" aria-busy="true" role="status">
      <span className="sr-only">{t('accessibility.loadingPage')}</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[320px]" />
    </div>
  );
}

const linkClass =
  'inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-medium text-fg-2 outline-none transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-cyan/40';

/**
 * Frame for the sign-in pages: a slim header with the language and theme pickers, one centred column, no sidebar.
 * (The account page is a normal page inside the app shell.)
 */
export function AuthLayout() {
  const { t } = useTranslation();
  useApplyAppearance();
  useAuthSessionWatcher();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas" style={{ backgroundImage: 'radial-gradient(70% 38% at 50% 0%, var(--c-glow), transparent)' }}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-card-hi focus:px-4 focus:py-2.5 focus:text-[13px] focus:font-medium focus:text-fg"
      >
        {t('navigation.skipToContent')}
      </a>
      <header className="mx-auto flex h-16 w-full max-w-[1040px] shrink-0 items-center gap-2 px-3 sm:px-5">
        <Link to={paths.home} aria-label={t('navigation.home')} className="inline-flex shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan/40">
          <Logo className="[&>span:last-child]:max-[359px]:hidden" />
        </Link>
        <div className="ms-auto flex items-center gap-0.5 sm:gap-1">
          <Link to={paths.home} className={linkClass}>
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            <span className="hidden sm:inline">{t('auth.layout.back')}</span>
            <span className="sr-only sm:hidden">{t('auth.layout.back')}</span>
          </Link>
          <LanguageSelector />
          <ThemeSelector />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1040px] flex-1 px-3 pb-8 pt-2 outline-none sm:px-5">
        <Suspense fallback={<AuthFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="mx-auto w-full max-w-[1040px] px-3 pb-6 text-center text-[11.5px] text-fg-3 sm:px-5">
        <p>{t('footer.version', { version: APP_VERSION, mode: t('footer.modeDemo') })}</p>
      </footer>
      <RouteAnnouncer />
      <Toaster />
    </div>
  );
}
