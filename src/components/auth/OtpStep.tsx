import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Field, Input, fieldAria } from '@/components/ui/Field';
import { formatClock, useCountdown } from '@/hooks/useCountdown';
import { useAuthErrorMessage } from '@/hooks/useAuth';
import { OTP_LENGTH, normaliseCode } from '@/services/auth/otp';
import { resendCode } from '@/services/auth/flows';
import type { IssuedChallenge } from '@/stores/otpStore';
import { toast } from '@/stores/toastStore';
import { focusDemoInbox } from './DemoInbox';
import { fullLg, wrapSm } from './styles';

interface OtpStepProps {
  challenge: IssuedChallenge;
  /** The parent keeps the current challenge; "send a new code" hands it a fresh one. */
  onChallenge: (next: IssuedChallenge) => void;
  /** "We sent a 6-digit code to …" */
  description: ReactNode;
  submitLabel: string;
  /** Receives the six digits. Throw an `AuthError` to show it under the field (the field is cleared). */
  onSubmit: (code: string) => Promise<void> | void;
  onBack: () => void;
}

/** "Enter the code we sent you": the field, the expiry clock, resend with its cooldown, and a way back. */
export function OtpStep({ challenge, onChallenge, description, submitLabel, onSubmit, onBack }: OtpStepProps) {
  const { t } = useTranslation();
  const errorText = useAuthErrorMessage();
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const secondsLeft = useCountdown(challenge.expiresAt);
  const resendWait = useCountdown(challenge.resendAt);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (code.length !== OTP_LENGTH) {
      setError(t('auth.validation.codeFormat'));
      input.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(code);
    } catch (err) {
      setError(errorText(err));
      setCode('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = (): void => {
    try {
      onChallenge(resendCode(challenge));
      setCode('');
      setError(null);
      toast.success(t('auth.otp.resent'));
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-fg-2">{description}</p>
      <Button variant="secondary" size="sm" className={`lg:hidden ${wrapSm}`} onClick={focusDemoInbox}>
        <Inbox className="size-4" aria-hidden />
        {t('auth.inbox.jump')}
      </Button>
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4" aria-label={submitLabel}>
        <Field label={t('auth.fields.code')} htmlFor="otp-code" error={error ?? undefined} hint={t('auth.fields.codeHint')}>
          <Input
            {...fieldAria('otp-code', error ?? undefined, true)}
            ref={input}
            value={code}
            onChange={(e) => setCode(normaliseCode(e.target.value).slice(0, OTP_LENGTH))}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH + 4}
            dir="ltr"
            spellCheck={false}
            className="h-12 text-center font-mono text-[20px] tabular-nums tracking-[0.5em]"
          />
        </Field>
        <p className={secondsLeft > 0 ? 'text-[12px] text-fg-3' : 'text-[12px] font-medium text-red'}>
          {secondsLeft > 0 ? t('auth.otp.expiresIn', { time: formatClock(secondsLeft) }) : t('auth.errors.otpExpired')}
        </p>
        <Button type="submit" variant="primary" size="lg" className={fullLg} loading={busy}>
          {submitLabel}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className={wrapSm} onClick={onBack}>
            {t('auth.common.back')}
          </Button>
          <Button variant="secondary" size="sm" className={wrapSm} onClick={resend} disabled={resendWait > 0}>
            {resendWait > 0 ? t('auth.otp.resendIn', { count: resendWait }) : t('auth.otp.resend')}
          </Button>
        </div>
      </form>
    </div>
  );
}
