import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { fullLg } from '@/components/auth/styles';
import { AuthCard, AuthSplit, authLink } from '@/components/auth/AuthCard';
import { GoogleSignIn } from '@/components/auth/GoogleSignIn';
import { OtpStep } from '@/components/auth/OtpStep';
import { PasswordField } from '@/components/auth/PasswordField';
import { useAuthSchemas } from '@/components/auth/useAuthSchemas';
import { Button } from '@/components/ui/Button';
import { DemoNotice } from '@/components/ui/Demo';
import { Field, Input, fieldAria } from '@/components/ui/Field';
import { useAuthErrorMessage } from '@/hooks/useAuth';
import { paths, safeNext } from '@/lib/paths';
import { completeRegistration, startRegistration, verifyCode } from '@/services/auth/flows';
import { cryptoAvailable } from '@/services/auth/password';
import { AuthError, type AuthAccount } from '@/services/auth/types';
import { useCurrentAccount } from '@/stores/authStore';
import type { IssuedChallenge } from '@/stores/otpStore';
import { toast } from '@/stores/toastStore';

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirm: string;
}

type Step = 'details' | 'verify' | 'done';

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const account = useCurrentAccount();
  const [alreadySignedIn] = useState(account !== null);
  const schemas = useAuthSchemas();
  const errorText = useAuthErrorMessage();

  const [step, setStep] = useState<Step>('details');
  const [pending, setPending] = useState<RegisterForm | null>(null);
  const [challenge, setChallenge] = useState<IssuedChallenge | null>(null);
  const [created, setCreated] = useState<AuthAccount | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({ username: schemas.username, email: schemas.email, password: z.string(), confirm: z.string() })
        .superRefine((v, ctx) =>
          schemas.validateNewPassword(v.password, v.confirm, { username: v.username, email: v.email }, (field, message) => ctx.addIssue({ code: 'custom', path: [field], message })),
        ),
    [schemas],
  );
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues: { username: '', email: '', password: '', confirm: '' } });
  const values = watch();

  const finish = (signedIn: AuthAccount): void => {
    toast.success(t('auth.toast.signedIn', { name: signedIn.username }));
    navigate(next ?? paths.myAccount, { replace: true });
  };

  // step 1: the username and address must be free; then the code is "sent" to the Demo inbox
  const onDetails = handleSubmit((v) => {
    setFormError(null);
    try {
      setChallenge(startRegistration({ username: v.username, email: v.email }));
      setPending({ ...v, username: v.username.trim(), email: v.email.trim() });
      setStep('verify');
    } catch (e) {
      if (e instanceof AuthError && e.code === 'usernameTaken') setError('username', { message: errorText(e) });
      else if (e instanceof AuthError && e.code === 'emailTaken') setError('email', { message: errorText(e) });
      else setFormError(errorText(e));
    }
  });

  // step 2: check the code, then create the account (which also signs in)
  const onVerify = async (code: string): Promise<void> => {
    if (!challenge || !pending) return;
    verifyCode(challenge.id, code);
    setCreated(await completeRegistration({ challengeId: challenge.id, username: pending.username, email: pending.email, password: pending.password }));
    setStep('done');
  };

  if (alreadySignedIn) return <Navigate to={next ?? paths.myAccount} replace />;

  if (step === 'verify' && challenge && pending) {
    return (
      <AuthSplit>
        <AuthCard title={t('auth.register.verifyTitle')} step={{ current: 2, total: 2 }} focusKey="verify">
          <OtpStep
            challenge={challenge}
            onChallenge={setChallenge}
            description={t('auth.otp.sentTo', { email: pending.email })}
            submitLabel={t('auth.register.verifySubmit')}
            onSubmit={onVerify}
            onBack={() => setStep('details')}
          />
        </AuthCard>
      </AuthSplit>
    );
  }

  if (step === 'done' && created) {
    return (
      <AuthSplit>
        <AuthCard title={t('auth.register.doneTitle')} focusKey="done">
          <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-fg-2" role="status">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-green" aria-hidden />
            {t('auth.register.doneBody', { name: created.username })}
          </p>
          <Button variant="primary" size="lg" className={fullLg} onClick={() => navigate(next ?? paths.myAccount, { replace: true })}>
            {t('auth.common.continue')}
          </Button>
        </AuthCard>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit>
      <AuthCard
        title={t('auth.register.title')}
        description={t('auth.register.subtitle')}
        step={{ current: 1, total: 2 }}
        focusKey="details"
        footer={
          <>
            <span>{t('auth.register.haveAccount')}</span>
            <Link to={{ pathname: paths.login, search: params.toString() }} className={authLink}>
              {t('auth.login.submit')}
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
        <form onSubmit={(e) => void onDetails(e)} noValidate className="space-y-4" aria-label={t('auth.register.title')}>
          {formError ? (
            <p role="alert" className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[12.5px] text-red">
              {formError}
            </p>
          ) : null}
          <Field label={t('auth.fields.username')} htmlFor="register-username" error={errors.username?.message} hint={t('auth.fields.usernameHint')}>
            <Input {...fieldAria('register-username', errors.username?.message, true)} {...register('username')} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </Field>
          <Field label={t('auth.fields.email')} htmlFor="register-email" error={errors.email?.message} hint={t('auth.fields.emailHint')}>
            <Input {...fieldAria('register-email', errors.email?.message, true)} {...register('email')} type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} dir="ltr" />
          </Field>
          <PasswordField
            id="register-password"
            label={t('auth.fields.password')}
            registration={register('password')}
            error={errors.password?.message}
            autoComplete="new-password"
            meter={{ value: values.password, context: { username: values.username, email: values.email } }}
          />
          <PasswordField id="register-confirm" label={t('auth.fields.confirmPassword')} registration={register('confirm')} error={errors.confirm?.message} autoComplete="new-password" />
          <Button type="submit" variant="primary" size="lg" className={fullLg} loading={isSubmitting}>
            {t('auth.register.submit')}
          </Button>
        </form>
        <p className="flex items-center gap-3 text-[11.5px] font-medium uppercase tracking-wider text-fg-3">
          <span aria-hidden className="h-px flex-1 bg-line" />
          {t('auth.google.divider')}
          <span aria-hidden className="h-px flex-1 bg-line" />
        </p>
        <GoogleSignIn mode="signup" remember={false} onSignedIn={finish} />
      </AuthCard>
    </AuthSplit>
  );
}
