import { useState } from 'react';
import { LogOut, Trash2 } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { wrapSm } from '@/components/auth/styles';
import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/Demo';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { useFormat } from '@/hooks/useFormat';
import { loginFor, paths } from '@/lib/paths';
import type { AuthMethod } from '@/services/auth/types';
import { useAuthStore, useCurrentAccount } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

const METHOD_LABEL: Record<AuthMethod, string> = {
  password: 'auth.account.methodPassword',
  google: 'auth.account.methodGoogle',
  'google-demo': 'auth.account.methodGoogleDemo',
};

/** The signed-in demo account. Guests are sent to the sign-in page and come back here afterwards. */
export default function MyAccountPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const navigate = useNavigate();
  const account = useCurrentAccount();
  const session = useAuthStore((s) => s.session);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Signing out empties the session while this page is still mounted: without this flag the guard below would
  // send the visitor to the sign-in page instead of to the start page they asked for.
  const [leaving, setLeaving] = useState(false);

  if (!account || !session) return leaving ? null : <Navigate to={loginFor(paths.myAccount)} replace />;

  const signOut = (): void => {
    setLeaving(true);
    useAuthStore.getState().signOut();
    toast.success(t('auth.toast.signedOut'));
    navigate(paths.home);
  };
  const remove = (): void => {
    setLeaving(true);
    useAuthStore.getState().deleteAccount();
    setConfirmDelete(false);
    toast.success(t('auth.toast.accountDeleted'));
    navigate(paths.home);
  };

  const rows: Array<[string, string, boolean?]> = [
    [t('auth.account.username'), account.username, true],
    [t('auth.account.email'), account.email, true],
    [t('auth.account.method'), t(METHOD_LABEL[session.method])],
    [t('auth.account.created'), fmt.dateTime(account.createdAt)],
    [t('auth.account.lastSignIn'), account.lastSignInAt ? fmt.dateTime(account.lastSignInAt) : '—'],
    [t('auth.account.sessionEnds'), fmt.dateTime(session.expiresAt)],
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={t('auth.account.title')} description={t('auth.account.subtitle')} badge={<DemoBadge />} actions={
        <Button variant="secondary" className={wrapSm} onClick={signOut}>
          <LogOut className="size-4" aria-hidden />
          {t('auth.account.signOut')}
        </Button>
      } />
      <Panel className="p-5">
        <dl className="divide-y divide-line text-[13px]">
          {rows.map(([label, value, ltr]) => (
            <div key={label} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <dt className="text-fg-3">{label}</dt>
              <dd dir={ltr ? 'ltr' : undefined} className={ltr ? 'ltr-isolate min-w-0 break-all font-medium text-fg sm:text-end' : 'min-w-0 font-medium text-fg sm:text-end'}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12px] leading-relaxed text-fg-3">{t('auth.account.storage')}</p>
      </Panel>
      <Panel className="p-5">
        <h2 className="font-display text-[15px] font-semibold text-fg">{t('auth.account.deleteTitle')}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">{t('auth.account.deleteBody')}</p>
        <Button variant="danger" size="sm" className={`mt-3 ${wrapSm}`} onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-4" aria-hidden />
          {t('auth.account.deleteConfirm')}
        </Button>
      </Panel>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent title={t('auth.account.deleteTitle')} description={t('auth.account.deleteBody')} size="sm">
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" className={wrapSm}>{t('common.cancel')}</Button>
            </DialogClose>
            <Button variant="danger" className={wrapSm} onClick={remove}>
              {t('auth.account.deleteConfirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
