import { useState, type ReactNode } from 'react';
import { Check, Circle, Eye, EyeOff } from 'lucide-react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field, Input, fieldAria } from '@/components/ui/Field';
import { checkPassword, passwordStrength, type PasswordContext } from '@/services/auth/password';
import { cn } from '@/lib/utils';

const STRENGTH_LABEL = ['auth.strength.tooShort', 'auth.strength.weak', 'auth.strength.fair', 'auth.strength.good', 'auth.strength.strong'] as const;
const STRENGTH_COLOR = ['bg-line', 'bg-red', 'bg-yellow', 'bg-cyan', 'bg-green'] as const;

const RULES = [
  ['length', 'auth.rules.length'],
  ['mixed', 'auth.rules.mixed'],
  ['notCommon', 'auth.rules.notCommon'],
  ['notPersonal', 'auth.rules.notPersonal'],
] as const;

/** Strength bar and the checklist the password policy is made of. */
export function PasswordMeter({ value, context }: { value: string; context: PasswordContext }) {
  const { t } = useTranslation();
  const score = passwordStrength(value);
  const check = checkPassword(value, context);
  const label = t(STRENGTH_LABEL[score]);
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <div role="img" aria-label={`${t('auth.strength.label')}: ${label}`} className="flex flex-1 gap-1">
          {[1, 2, 3, 4].map((step) => (
            <span key={step} className={cn('h-1.5 flex-1 rounded-full transition-colors', value && score >= step ? STRENGTH_COLOR[score] : 'bg-line')} />
          ))}
        </div>
        <span aria-hidden className="min-w-[4.5rem] text-end text-[11.5px] font-medium text-fg-2">
          {value ? label : ''}
        </span>
      </div>
      <div>
        <p className="mb-1 text-[11.5px] font-medium text-fg-3">{t('auth.rules.title')}</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {RULES.map(([rule, key]) => {
            const met = value !== '' && check[rule];
            return (
              <li key={rule} className={cn('flex items-start gap-1.5 text-[12px]', met ? 'text-fg-2' : 'text-fg-3')}>
                {met ? <Check className="mt-0.5 size-3.5 shrink-0 text-green" aria-hidden /> : <Circle className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
                <span>
                  {t(key)}
                  <span className="sr-only"> — {met ? t('auth.rules.met') : t('auth.rules.unmet')}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  autoComplete: 'current-password' | 'new-password';
  hint?: ReactNode;
  /** Link or button at the end of the label row ("Forgot password?"). */
  aside?: ReactNode;
  /** The value typed so far; when given, the strength meter and checklist are shown below the field. */
  meter?: { value: string; context: PasswordContext };
}

/** A password input with a show / hide toggle (and, optionally, the strength meter). */
export function PasswordField({ id, label, registration, error, autoComplete, hint, aside, meter }: PasswordFieldProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <Field label={label} htmlFor={id} error={error} hint={hint} aside={aside}>
        <div className="relative">
          <Input
            {...fieldAria(id, error, Boolean(hint))}
            {...registration}
            type={visible ? 'text' : 'password'}
            autoComplete={autoComplete}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            dir="ltr"
            className="pe-11"
          />
          <button
            type="button"
            aria-label={visible ? t('auth.fields.hidePassword') : t('auth.fields.showPassword')}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
            className="absolute end-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-fg-3 outline-none transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-cyan/40"
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      </Field>
      {meter ? <PasswordMeter value={meter.value} context={meter.context} /> : null}
    </div>
  );
}
