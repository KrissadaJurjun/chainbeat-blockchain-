import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { EMAIL_MAX, EMAIL_PATTERN, USERNAME_CHARS, USERNAME_MAX, USERNAME_MIN } from '@/services/auth/accounts';
import { PASSWORD_MAX, PASSWORD_MIN, checkPassword, type PasswordContext } from '@/services/auth/password';

/** The validation rules every sign-in form shares, with messages in the visitor's language. */
export function useAuthSchemas() {
  const { t } = useTranslation();
  return useMemo(() => {
    const required = t('auth.validation.required');
    const emailInvalid = t('auth.validation.emailInvalid');
    const usernameLength = t('auth.validation.usernameLength');

    return {
      username: z.string().trim().min(1, required).min(USERNAME_MIN, usernameLength).max(USERNAME_MAX, usernameLength).regex(USERNAME_CHARS, t('auth.validation.usernameChars')),
      email: z.string().trim().min(1, required).max(EMAIL_MAX, emailInvalid).regex(EMAIL_PATTERN, emailInvalid),
      /** A username or an email address. */
      identifier: z.string().trim().min(1, required).max(EMAIL_MAX, required),
      /** When signing in only "something was typed" is checked; the real test is the stored hash. */
      loginPassword: z.string().min(1, required).max(PASSWORD_MAX, t('auth.validation.passwordLong')),
      /**
       * The rules for choosing a password, for use inside a form schema's `superRefine`:
       * the password against the policy (and the username / email it must not contain), and the confirmation against it.
       */
      validateNewPassword: (password: string, confirm: string, context: PasswordContext, report: (field: 'password' | 'confirm', message: string) => void): void => {
        if (password.length === 0) report('password', required);
        else if (password.length < PASSWORD_MIN) report('password', t('auth.validation.passwordShort'));
        else if (password.length > PASSWORD_MAX) report('password', t('auth.validation.passwordLong'));
        else if (!checkPassword(password, context).ok) report('password', t('auth.validation.passwordWeak'));
        if (confirm !== password) report('confirm', confirm.length === 0 ? required : t('auth.validation.passwordMismatch'));
      },
    };
  }, [t]);
}
