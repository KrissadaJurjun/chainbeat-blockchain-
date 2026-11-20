import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Feedback';
import { useAuthSessionWatcher } from '@/hooks/useAuth';
import { useNotificationEvents } from '@/hooks/useNotificationEvents';
import { Toaster } from '@/components/ui/Toaster';
import { Footer } from './Footer';
import { GlobalDialogs } from './GlobalDialogs';
import { Header } from './Header';
import { DesktopSidebar } from './Sidebar';
import { useApplyAppearance } from './ThemeSelector';

/**
 * Tells screen-reader users that the page changed (a single-page app has no page load to announce it).
 * It reads the new page's main heading a moment after navigation, once the page has rendered.
 */
export function RouteAnnouncer() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [message, setMessage] = useState('');
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false; // the initial load is announced by the browser
      return;
    }
    const id = window.setTimeout(() => {
      const title = document.querySelector('main h1')?.textContent?.trim() || document.title.replace(/ · ChainBeat$/, '');
      setMessage(t('accessibility.navigatedTo', { title }));
    }, 600);
    return () => window.clearTimeout(id);
  }, [pathname, t]);

  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}

function RouteFallback() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4" aria-busy="true" role="status">
      <span className="sr-only">{t('accessibility.loadingPage')}</span>
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <Skeleton className="h-[380px]" />
        <Skeleton className="h-[380px]" />
      </div>
    </div>
  );
}

/**
 * Application frame. The app fills the whole browser viewport: no outer margin, backdrop or rounded "window".
 * On desktop (≥ lg) the header sits on the top edge, the sidebar on the left edge and the content area scrolls
 * internally; below lg the page scrolls naturally, the header is sticky and the sidebar becomes a drawer.
 */
export function AppShell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  useApplyAppearance();
  useNotificationEvents();
  useAuthSessionWatcher();

  // Route changes should land at the top of the new page.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-dvh w-full bg-canvas lg:flex lg:h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-card-hi focus:px-4 focus:py-2.5 focus:text-[13px] focus:font-medium focus:text-fg"
      >
        {t('navigation.skipToContent')}
      </a>
      <div className="flex min-h-dvh w-full min-w-0 flex-col lg:min-h-0 lg:overflow-hidden">
        <Header />
        <div className="flex min-h-0 flex-1">
          <DesktopSidebar />
          {/* The scroll container wraps <main> AND the footer, so the footer is a page-level `contentinfo` landmark. */}
          <div ref={scrollRef} className="min-w-0 flex-1 bg-canvas lg:overflow-y-auto">
            <main id="main" tabIndex={-1} className="p-3 outline-none sm:p-4 lg:p-[18px] lg:pb-0 lg:pt-4">
              <Suspense fallback={<RouteFallback />}>
                <Outlet />
              </Suspense>
            </main>
            <Footer />
          </div>
        </div>
      </div>
      <RouteAnnouncer />
      <GlobalDialogs />
      <Toaster />
    </div>
  );
}
