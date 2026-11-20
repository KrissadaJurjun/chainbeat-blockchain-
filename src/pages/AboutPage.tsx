import { FlaskConical, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LogoMark } from '@/components/brand/Logo';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { APP_VERSION } from '@/config/env';
import { availableLanguages, LANGUAGES } from '@/i18n/languages';

const SHORTCUTS: ReadonlyArray<[string, string]> = [
  ['about.shortcutPalette', 'Ctrl + K'],
  ['about.shortcutSearch', '/'],
  ['about.shortcutClose', 'Esc'],
];

export default function AboutPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <PageHeader title={t('about.title')} description={t('about.pageDescription')} />
      <Panel className="space-y-4 p-5 text-[13px] leading-relaxed text-fg-2">
        <div className="flex items-center gap-3.5">
          <LogoMark className="size-14" />
          <div>
            <p className="font-display text-[20px] font-bold text-fg">ChainBeat</p>
            <p className="text-fg-3">{t('footer.tagline')}</p>
            <p className="mt-0.5 text-[12px] tabular-nums text-fg-3">{t('footer.version', { version: APP_VERSION, mode: t('footer.modeDemo') })}</p>
          </div>
        </div>
        <p className="flex gap-2.5 rounded-lg border border-yellow/25 bg-yellow/8 p-3">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-yellow" aria-hidden />
          <span>{t('about.demo')}</span>
        </p>
        <p className="flex gap-2.5 rounded-lg border border-line bg-card/50 p-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-green" aria-hidden />
          <span>{t('about.privacy')}</span>
        </p>
        <p>{t('about.languages', { shipped: availableLanguages.length, total: LANGUAGES.length })}</p>
      </Panel>
      <Panel className="p-5">
        <h2 className="mb-2 font-display text-[15px] font-semibold text-fg">{t('about.shortcuts')}</h2>
        <ul className="space-y-2 text-[13px] text-fg-2">
          {SHORTCUTS.map(([key, combo]) => (
            <li key={key} className="flex items-center justify-between gap-4">
              <span>{t(key)}</span>
              <kbd dir="ltr" className="rounded border border-line-strong px-1.5 py-0.5 font-sans text-[11px] text-fg">
                {combo}
              </kbd>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
