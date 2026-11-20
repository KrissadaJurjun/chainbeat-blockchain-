import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createFormatter, type Formatter } from '@/lib/format';
import { getLanguage } from '@/i18n/languages';

/** A formatter bound to the active UI language. Re-renders consumers when the language changes. */
export function useFormat(): Formatter {
  const { i18n } = useTranslation();
  const locale = getLanguage(i18n.language).intl;
  return useMemo(() => createFormatter(locale), [locale]);
}
