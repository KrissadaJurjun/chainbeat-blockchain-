import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { fullLg } from '@/components/auth/styles';
import { AuthCard, AuthSplit, authLink } from '@/components/auth/AuthCard';
import { OtpStep } from '@/components/auth/OtpStep';
import { useAuthSchemas } from '@/components/auth/useAuthSchemas';
import { Button } from '@/components/ui/Button';
import { DemoNotice } from '@/components/ui/Demo';
import { Field, Input, fieldAria } from '@/components/ui/Field';
import { useAuthErrorMessage } from '@/hooks/useAuth';
import { paths } from '@/lib/paths';
import { revealUsername, startUsernameRecovery, verifyCode } from '@/services/auth/flows';
import type { IssuedChallenge } from '@/stores/otpStore';

type Step = 'request' | 'verify' | 'result';

export default function ForgotUsernamePage() {
  const { t } = useTranslation();
  const schemas = useAuthSchemas();
  const errorText = useAuthErrorMessage();
  const [step, setStep] = useState<Step>('request');
  const [challenge, setChallenge] = useState<IssuedChallenge | null>(null);
  const [found, setFound] = useState<{ username: string; email: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(() => z.object({ email: schemas.email }), [schemas]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues: { email: '' } });

  const onRequest = handleSubmit((v) => {
    setFormError(null);
    try {
      setChallenge(startUsernameRecovery(v.email));
      setStep('verify');
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
        <AuthCard title={t('auth.forgotUsername.verifyTitle')} step={{ current: 2, total: 2 }} focusKey="verify" footer={back}>
          <OtpStep
            challenge={challenge}
            onChallenge={setChallenge}
            description={t('auth.otp.sentTo', { email: challenge.target })}
            submitLabel={t('auth.forgotUsername.verifySubmit')}
            onSubmit={(code) => {
              verifyCode(challenge.id, code);
              setFound(revealUsername(challenge.id));
              setStep('result');
            }}
            onBack={() => setStep('request')}
          />
        </AuthCard>
      </AuthSplit>
    );
  }

  if (step === 'result' && found) {
    return (
      <AuthSplit>
        <AuthCard title={t('auth.forgotUsername.resultTitle')} focusKey="result" footer={back}>
          <p className="text-[13px] leading-relaxed text-fg-2">{t('auth.forgotUsername.resultBody', { email: found.email })}</p>
          <p role="status" className="flex items-center gap-2.5 rounded-xl border border-active-line bg-active/40 px-3.5 py-3">
            <UserRound className="size-5 shrink-0 text-cyan" aria-hidden />
            <strong data-testid="recovered-username" dir="ltr" className="ltr-isolate min-w-0 break-all font-mono text-[17px] text-fg">
              {found.username}
            </strong>
          </p>
          <Button asChild variant="primary" size="lg" className={fullLg}>
            <Link to={paths.login}>{t('auth.forgotUsername.useIt')}</Link>
          </Button>
        </AuthCard>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit>
      <AuthCard title={t('auth.forgotUsername.title')} description={t('auth.forgotUsername.subtitle')} step={{ current: 1, total: 2 }} focusKey="request" footer={back}>
        <DemoNotice bare>{t('auth.layout.demoNotice')}</DemoNotice>
        <form onSubmit={(e) => void onRequest(e)} noValidate className="space-y-4" aria-label={t('auth.forgotUsername.title')}>
          {formError ? (
            <p role="alert" className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[12.5px] text-red">
              {formError}
            </p>
          ) : null}
          <Field label={t('auth.fields.email')} htmlFor="forgot-username-email" error={errors.email?.message}>
            <Input {...fieldAria('forgot-username-email', errors.email?.message)} {...register('email')} type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} dir="ltr" />
          </Field>
          <Button type="submit" variant="primary" size="lg" className={fullLg} loading={isSubmitting}>
            {t('auth.forgotUsername.submit')}
          </Button>
        </form>
      </AuthCard>
    </AuthSplit>
  );
}
