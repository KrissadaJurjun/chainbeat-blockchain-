import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { fullLg } from '@/components/auth/styles';
import { AuthCard, authLink } from '@/components/auth/AuthCard';
import { GoogleSignIn } from '@/components/auth/GoogleSignIn';
import { PasswordField } from '@/components/auth/PasswordField';
import { useAuthSchemas } from '@/components/auth/useAuthSchemas';
import { Button } from '@/components/ui/Button';
import { DemoNotice } from '@/components/ui/Demo';
import { Field, Input, fieldAria } from '@/components/ui/Field';
import { useAuthErrorMessage } from '@/hooks/useAuth';
import { paths, safeNext } from '@/lib/paths';
import { cryptoAvailable } from '@/services/auth/password';
import type { AuthAccount } from '@/services/auth/types';
import { useAuthStore, useCurrentAccount } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

interface LoginForm {
  identifier: string;
  password: string;
  remember: boolean;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const account = useCurrentAccount();
  const [alreadySignedIn] = useState(account !== null);
  const schemas = useAuthSchemas();
  const errorText = useAuthErrorMessage();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(() => z.object({ identifier: schemas.identifier, password: schemas.loginPassword, remember: z.boolean() }), [schemas]);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues: { identifier: '', password: '', remember: false } });
  const remember = watch('remember');

  const finish = (signedIn: AuthAccount): void => {
    toast.success(t('auth.toast.signedIn', { name: signedIn.username }));
    navigate(next ?? paths.myAccount, { replace: true });
  };

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      finish(await useAuthStore.getState().signIn({ identifier: v.identifier, password: v.password, remember: v.remember }));
    } catch (e) {
      setFormError(errorText(e));
    }
  });

  if (alreadySignedIn) return <Navigate to={next ?? paths.myAccount} replace />;

  return (
    <div className="mx-auto w-full max-w-[440px]">
      <AuthCard
        title={t('auth.login.title')}
        description={next ? t('auth.login.needSignIn') : t('auth.login.subtitle')}
        footer={
          <>
            <span>{t('auth.login.noAccount')}</span>
            <Link to={{ pathname: paths.register, search: params.toString() }} className={authLink}>
              {t('auth.login.createAccount')}
            </Link>
          </>
        }
      >
        <DemoNotice bare>{t('auth.layout.demoNotice')}</DemoNotice>
        {!cryptoAvailable() ? (
          <p role="alert" className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[12.5px] text-red">
            {t('auth.errors.cryptoUnavailable')}
          </p>
        ) : null}
        <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-4" aria-label={t('auth.login.title')}>
          {formError ? (
            <p role="alert" className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[12.5px] text-red">
              {formError}
            </p>
          ) : null}
          <Field
            label={t('auth.fields.identifier')}
            htmlFor="login-identifier"
            error={errors.identifier?.message}
            aside={
              <Link to={paths.forgotUsername} className={`${authLink} text-[12px]`}>
                {t('auth.login.forgotUsername')}
              </Link>
            }
          >
            <Input {...fieldAria('login-identifier', errors.identifier?.message)} {...register('identifier')} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </Field>
          <PasswordField
            id="login-password"
            label={t('auth.fields.password')}
            registration={register('password')}
            error={errors.password?.message}
            autoComplete="current-password"
            aside={
              <Link to={paths.forgotPassword} className={`${authLink} text-[12px]`}>
                {t('auth.login.forgotPassword')}
              </Link>
            }
          />
          <label className="flex items-center gap-2.5 text-[12.5px] text-fg-2">
            <input type="checkbox" {...register('remember')} className="size-4 shrink-0 rounded accent-[var(--c-brand)]" />
            {t('auth.fields.remember')}
          </label>
          <Button type="submit" variant="primary" size="lg" className={fullLg} loading={isSubmitting}>
            {t('auth.login.submit')}
          </Button>
        </form>
        <p className="flex items-center gap-3 text-[11.5px] font-medium uppercase tracking-wider text-fg-3">
          <span aria-hidden className="h-px flex-1 bg-line" />
          {t('auth.google.divider')}
          <span aria-hidden className="h-px flex-1 bg-line" />
        </p>
        <GoogleSignIn mode="signin" remember={remember} onSignedIn={finish} />
      </AuthCard>
    </div>
  );
}
