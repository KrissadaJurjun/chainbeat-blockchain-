import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/Feedback';

/** Last-resort boundary: a render error in one route never blanks the whole app shell with a stack trace. */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : undefined;
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas p-6">
      <div className="panel w-full max-w-lg">
        <ErrorState
          title={t('states.crashTitle')}
          description={detail ? `${t('states.crashBody')} (${detail})` : t('states.crashBody')}
        />
        <div className="flex justify-center gap-2 pb-6">
          <Button variant="primary" onClick={() => window.location.reload()}>
            {t('states.reload')}
          </Button>
          <Button asChild variant="secondary">
            <Link to="/">{t('notFound.home')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
