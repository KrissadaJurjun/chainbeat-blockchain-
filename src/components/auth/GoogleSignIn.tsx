import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useResolvedTheme } from '@/components/layout/ThemeSelector';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field, Input, fieldAria } from '@/components/ui/Field';
import { GOOGLE_CLIENT_ID, looksLikeClientSecret } from '@/config/env';
import { useAuthErrorMessage } from '@/hooks/useAuth';
import { loadGoogleIdentity, initialiseGoogle, pageNonce, parseGoogleClientId, parseGoogleCredential, setGoogleCredentialHandler } from '@/services/auth/google';
import type { AuthAccount } from '@/services/auth/types';
import { DEMO_GOOGLE_PROFILE, useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { fullLg, wrapSm } from './styles';

/** Google's "G" mark in its brand colours (the official artwork). */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * The origin to list under "Authorized JavaScript origins". Google accepts `localhost` but not a bare IP address, so a
 * page opened as http://127.0.0.1:4173 is told to use http://localhost:4173 (and to open the site that way).
 */
export function authorizedOrigin(): string {
  return window.location.origin.replace('//127.0.0.1', '//localhost').replace('//[::1]', '//localhost');
}

/** "Paste your own Google client ID" — the one thing the visitor has to do to turn the simulation into the real button. */
function GoogleSetup() {
  const { t } = useTranslation();
  const saved = useAuthStore((s) => s.googleClientId);
  const setClientId = useAuthStore((s) => s.setGoogleClientId);
  const [value, setValue] = useState(saved ?? '');
  const [error, setError] = useState<string | undefined>();

  const save = (e: FormEvent): void => {
    e.preventDefault();
    if (looksLikeClientSecret(value)) return setError(t('auth.google.errorSecret'));
    const id = parseGoogleClientId(value);
    if (!id) return setError(t('auth.google.errorFormat'));
    setError(undefined);
    setValue(id);
    setClientId(id);
    toast.success(t('auth.google.saved'));
  };
  const remove = (): void => {
    setClientId(null);
    setValue('');
    setError(undefined);
    toast.success(t('auth.google.removed'));
  };

  return (
    <details className="group rounded-xl border border-line bg-card/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] font-medium text-fg-2 outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-cyan/40 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90" aria-hidden />
        {t('auth.google.setupTitle')}
      </summary>
      <div className="space-y-3 border-t border-line px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-2">
        <p>{t('auth.google.setupIntro')}</p>
        <ol className="list-decimal space-y-1.5 ps-5">
          <li>{t('auth.google.step1')}</li>
          <li>{t('auth.google.step2', { origin: authorizedOrigin() })}</li>
          <li>{t('auth.google.step3')}</li>
        </ol>
        {GOOGLE_CLIENT_ID ? (
          <p className="font-medium text-fg">{t('auth.google.fromBuild')}</p>
        ) : (
          <form onSubmit={save} noValidate className="space-y-2.5">
            <Field label={t('auth.google.clientId')} htmlFor="google-client-id" error={error}>
              <Input
                {...fieldAria('google-client-id', error)}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                dir="ltr"
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="none"
                placeholder="1234567890-abc….apps.googleusercontent.com"
                className="font-mono text-[12px]"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" size="sm" className={wrapSm}>
                {t('auth.google.save')}
              </Button>
              {saved ? (
                <Button variant="ghost" size="sm" className={wrapSm} onClick={remove}>
                  {t('auth.google.remove')}
                </Button>
              ) : null}
            </div>
          </form>
        )}
        <p className="text-fg-3">{t('auth.google.privacy')}</p>
      </div>
    </details>
  );
}

interface GoogleSignInProps {
  mode: 'signin' | 'signup';
  /** Whether the visitor ticked "keep me signed in" on the form next to the button. */
  remember: boolean;
  onSignedIn: (account: AuthAccount) => void;
}

/**
 * "Sign in with Google". With a client ID (build-time or pasted) it is Google's own button, loaded on demand from
 * accounts.google.com. Without one it is a clearly-labelled simulation that never contacts Google — and a short guide
 * to getting a client ID, which is the only thing that makes it real.
 */
export function GoogleSignIn({ mode, remember, onSignedIn }: GoogleSignInProps) {
  const { t } = useTranslation();
  const errorText = useAuthErrorMessage();
  const theme = useResolvedTheme();
  const saved = useAuthStore((s) => s.googleClientId);
  const clientId = GOOGLE_CLIENT_ID ?? parseGoogleClientId(saved);

  const holder = useRef<HTMLDivElement>(null);
  const latest = useRef({ remember, onSignedIn });
  useEffect(() => {
    latest.current = { remember, onSignedIn };
  });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setStatus('loading');
    const onCredential = (credential: string): void => {
      try {
        const profile = parseGoogleCredential(credential, { clientId, nonce: pageNonce, now: Date.now() });
        const account = useAuthStore.getState().signInWithGoogle(profile, 'google', latest.current.remember);
        setError(null);
        latest.current.onSignedIn(account);
      } catch (e) {
        setError(errorText(e));
      }
    };
    loadGoogleIdentity()
      .then((api) => {
        const parent = holder.current;
        if (cancelled || !parent) return;
        setGoogleCredentialHandler(onCredential);
        initialiseGoogle(api, clientId);
        parent.replaceChildren();
        api.renderButton(parent, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: mode === 'signup' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.round(Math.min(380, Math.max(200, parent.clientWidth || 300))),
        });
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
      setGoogleCredentialHandler(null);
    };
  }, [clientId, theme, mode, attempt, errorText]);

  const continueDemo = (): void => {
    const account = useAuthStore.getState().signInWithGoogle({ ...DEMO_GOOGLE_PROFILE, name: t('auth.google.demoName') }, 'google-demo', remember);
    setDemoOpen(false);
    onSignedIn(account);
  };

  return (
    <div className="space-y-3">
      {clientId ? (
        <div className="space-y-2">
          <div ref={holder} className="flex min-h-[44px] justify-center" />
          {status === 'loading' ? <p className="text-center text-[12px] text-fg-3">{t('auth.google.loading')}</p> : null}
          {status === 'error' ? (
            <div role="alert" className="space-y-2 rounded-lg border border-red/30 bg-red/10 px-3 py-2.5 text-[12.5px] text-red">
              <p>{t('auth.google.loadError')}</p>
              <Button variant="secondary" size="sm" className={wrapSm} onClick={() => setAttempt((n) => n + 1)}>
                {t('common.retry')}
              </Button>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[12.5px] text-red">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <Button variant="secondary" size="lg" className={fullLg} onClick={() => setDemoOpen(true)}>
            <GoogleMark className="size-[18px]" />
            {mode === 'signup' ? t('auth.google.signUpDemo') : t('auth.google.signInDemo')}
          </Button>
          <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
            <DialogContent title={t('auth.google.demoDialogTitle')} description={t('auth.google.demoDialogBody')} size="sm">
              <div className="flex items-center gap-3 rounded-xl border border-line bg-card/40 p-3">
                <GoogleMark className="size-6 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-fg">{t('auth.google.demoName')}</p>
                  <p dir="ltr" className="ltr-isolate truncate text-[12px] text-fg-3">
                    {DEMO_GOOGLE_PROFILE.email}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost" className={wrapSm}>{t('common.cancel')}</Button>
                </DialogClose>
                <Button variant="primary" className={wrapSm} onClick={continueDemo}>
                  {t('auth.google.demoContinue', { name: t('auth.google.demoName') })}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
      <GoogleSetup />
    </div>
  );
}
