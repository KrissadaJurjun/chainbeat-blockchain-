import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { fullLg } from '@/components/auth/styles';
import { AuthCard, AuthSplit, authLink } from '@/components/auth/AuthCard';
import { OtpStep } from '@/components/auth/OtpStep';
import { PasswordField } from '@/components/auth/PasswordField';
import { useAuthSchemas } from '@/components/auth/useAuthSchemas';
import { Button } from '@/components/ui/Button';
import { DemoNotice } from '@/components/ui/Demo';
import { Field, Input, fieldAria } from '@/components/ui/Field';
import { useAuthErrorMessage } from '@/hooks/useAuth';
import { paths } from '@/lib/paths';
import { findAccount } from '@/services/auth/accounts';
import { completePasswordReset, startPasswordReset, verifyCode } from '@/services/auth/flows';
import { cryptoAvailable } from '@/services/auth/password';
import { useAuthStore } from '@/stores/authStore';
import type { IssuedChallenge } from '@/stores/otpStore';
import { toast } from '@/stores/toastStore';

type Step = 'request' | 'verify' | 'new' | 'done';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const schemas = useAuthSchemas();
  const errorText = useAuthErrorMessage();
  const [step, setStep] = useState<Step>('request');
  const [challenge, setChallenge] = useState<IssuedChallenge | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const requestSchema = useMemo(() => z.object({ identifier: schemas.identifier }), [schemas]);
  const request = useForm<{ identifier: string }>({ resolver: zodResolver(requestSchema), mode: 'onTouched', defaultValues: { identifier: '' } });

  // the account behind a verified code (a code that verified always belongs to an existing account)
  const account = challenge && step === 'new' ? findAccount(useAuthStore.getState().accounts, challenge.target) : undefined;
  const context = { username: account?.username, email: account?.email };
  const newSchema = useMemo(
    () =>
      z
        .object({ password: z.string(), confirm: z.string() })
        .superRefine((v, ctx) => schemas.validateNewPassword(v.password, v.confirm, { username: account?.username, email: account?.email }, (field, message) => ctx.addIssue({ code: 'custom', path: [field], message }))),
    [schemas, account?.username, account?.email],
  );
  const reset = useForm<{ password: string; confirm: string }>({ resolver: zodResolver(newSchema), mode: 'onTouched', defaultValues: { password: '', confirm: '' } });

  const onRequest = request.handleSubmit((v) => {
    setFormError(null);
    try {
      setChallenge(startPasswordReset(v.identifier));
      setStep('verify');
    } catch (e) {
      setFormError(errorText(e));
    }
  });

  const onReset = reset.handleSubmit(async (v) => {
    if (!challenge) return;
    setFormError(null);
    try {
      await completePasswordReset({ challengeId: challenge.id, newPassword: v.password });
      toast.success(t('auth.toast.passwordReset'));
      setStep('done');
    } catch (e) {
      setFormError(errorText(e));
    }
  });

  const back = (
    <Link to={paths.login} className={authLink}>
      {t('auth.common.backToSignIn')}
    </Link>
  );

  if (step === 'verify' && challenge) {
    return (
      <AuthSplit>
        <AuthCard title={t('auth.forgotPassword.verifyTitle')} step={{ current: 2, total: 3 }} focusKey="verify" footer={back}>
          <OtpStep
            challenge={challenge}
            onChallenge={setChallenge}
            description={t('auth.otp.sentGeneric')}
            submitLabel={t('auth.forgotPassword.verifySubmit')}
            onSubmit={(code) => {
              verifyCode(challenge.id, code);
              setStep('new');
            }}
            onBack={() => setStep('request')}
          />
        </AuthCard>
      </AuthSplit>
    );
  }

  if (step === 'new' && challenge) {
    const { errors, isSubmitting } = reset.formState;
    const values = reset.watch();
    return (
      <AuthSplit>
        <AuthCard title={t('auth.forgotPassword.newTitle')} step={{ current: 3, total: 3 }} focusKey="new" footer={back}>
          {!cryptoAvailable() ? (
            <p role="alert" className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[12.5px] text-red">
              {t('auth.errors.cryptoUnavailable')}
            </p>
          ) : null}
          <form onSubmit={(e) => void onReset(e)} noValidate className="space-y-4" aria-label={t('auth.forgotPassword.newTitle')}>
            {formError ? (
              <p role="alert" className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[12.5px] text-red">
                {formError}
              </p>
            ) : null}
            <PasswordField
              id="reset-password"
              label={t('auth.fields.newPassword')}
              registration={reset.register('password')}
              error={errors.password?.message}
              autoComplete="new-password"
              meter={{ value: values.password, context }}
            />
            <PasswordField id="reset-confirm" label={t('auth.fields.confirmPassword')} registration={reset.register('confirm')} error={errors.confirm?.message} autoComplete="new-password" />
            <Button type="submit" variant="primary" size="lg" className={fullLg} loading={isSubmitting}>
              {t('auth.forgotPassword.newSubmit')}
            </Button>
          </form>
        </AuthCard>
      </AuthSplit>
    );
  }

  if (step === 'done') {
    return (
      <AuthSplit>
        <AuthCard title={t('auth.forgotPassword.doneTitle')} focusKey="done">
          <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-fg-2" role="status">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-green" aria-hidden />
            {t('auth.forgotPassword.doneBody')}
          </p>
          <Button asChild variant="primary" size="lg" className={fullLg}>
            <Link to={paths.login}>{t('auth.login.submit')}</Link>
          </Button>
        </AuthCard>
      </AuthSplit>
    );
  }

  const { errors, isSubmitting } = request.formState;
  return (
    <AuthSplit>
      <AuthCard title={t('auth.forgotPassword.title')} description={t('auth.forgotPassword.subtitle')} step={{ current: 1, total: 3 }} focusKey="request" footer={back}>
        <DemoNotice bare>{t('auth.layout.demoNotice')}</DemoNotice>
        <form onSubmit={(e) => void onRequest(e)} noValidate className="space-y-4" aria-label={t('auth.forgotPassword.title')}>
          {formError ? (
            <p role="alert" className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[12.5px] text-red">
              {formError}
            </p>
          ) : null}
          <Field label={t('auth.fields.identifier')} htmlFor="forgot-password-identifier" error={errors.identifier?.message}>
            <Input {...fieldAria('forgot-password-identifier', errors.identifier?.message)} {...request.register('identifier')} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </Field>
          <Button type="submit" variant="primary" size="lg" className={fullLg} loading={isSubmitting}>
            {t('auth.forgotPassword.submit')}
          </Button>
        </form>
      </AuthCard>
    </AuthSplit>
  );
}
