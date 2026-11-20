import { useState, type ReactNode } from 'react';
import { Moon, Monitor, Sun } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LanguageList } from '@/components/layout/LanguageSelector';
import { Button } from '@/components/ui/Button';

import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { LIVE_REST_URL } from '@/config/env';
import { useNetworkInfo, useSimulationActions } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { getLanguage, availableLanguages, LANGUAGES } from '@/i18n/languages';
import { LiveRequestError, createLiveClient } from '@/services/chain/liveClient';
import { SELECTABLE_CHAINS } from '@/services/chain/registry';
import { useChain, useChainStore } from '@/stores/chainStore';
import { SIM_SPEEDS, useSimStore } from '@/stores/simStore';
import { useSearchStore } from '@/stores/searchStore';
import { toast } from '@/stores/toastStore';
import { useUiStore, type RefreshPreference, type ThemePreference } from '@/stores/uiStore';
import { useWalletStore } from '@/stores/walletStore';

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <Panel className="min-w-0 p-5" aria-labelledby={id}>
      <h2 id={id} className="font-display text-[15px] font-semibold text-fg">
        {title}
      </h2>
      {description ? <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </Panel>
  );
}

function Row({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6">
      <label htmlFor={htmlFor} className="min-w-0 text-[13px] text-fg-2 sm:flex-1">
        {label}
        {hint ? <span className="block text-[12px] text-fg-3">{hint}</span> : null}
      </label>
      <div className="min-w-0 max-w-full sm:shrink-0">{children}</div>
    </div>
  );
}

/** Labels in other languages can be longer than the screen is wide: let these buttons wrap instead of overflowing. */
const WRAP = 'h-auto min-h-8 max-w-full whitespace-normal py-1.5 text-center leading-snug';

type Confirm = 'dataset' | 'wallet' | 'all' | null;
const STORAGE_KEYS: ReadonlyArray<[string, string]> = [
  ['chainbeat.lang', 'privacy.keys.lang'],
  ['chainbeat.ui', 'privacy.keys.ui'],
  ['chainbeat.chain', 'privacy.keys.chain'],
  ['chainbeat.sim', 'privacy.keys.sim'],
  ['chainbeat.wallet', 'privacy.keys.wallet'],
  ['chainbeat.notifications', 'privacy.keys.notifications'],
  ['chainbeat.search', 'privacy.keys.search'],
  ['chainbeat.auth', 'privacy.keys.auth'],
];

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const qc = useQueryClient();
  const setChain = useChainStore((s) => s.setChain);
  const net = useNetworkInfo().data;
  const ui = useUiStore();
  const speed = useSimStore((s) => s.speed);
  const sim = useSimulationActions();
  const clearSearches = useSearchStore((s) => s.clear);
  const resetWallet = useWalletStore((s) => s.resetDemo);
  const current = getLanguage(i18n.language);
  const [probe, setProbe] = useState<{ state: 'idle' | 'testing' | 'ok' | 'error'; text?: string }>({ state: 'idle' });

  /** Two read-only GET requests to the configured endpoint; the result is shown, nothing is stored and no data source changes. */
  const testConnection = async (): Promise<void> => {
    if (!LIVE_REST_URL) return;
    setProbe({ state: 'testing' });
    try {
      const c = await createLiveClient({ baseUrl: LIVE_REST_URL }).probe();
      setProbe({ state: 'ok', text: t(c.partial ? 'settings.network.testPartial' : 'settings.network.testOk', { chain: c.chainId, height: fmt.integer(c.height), ms: fmt.integer(c.latencyMs) }) });
    } catch (e) {
      setProbe({ state: 'error', text: t('settings.network.testError.' + (e instanceof LiveRequestError ? e.kind : 'network')) });
    }
  };
  const [confirm, setConfirm] = useState<Confirm>(null);

  const run = (kind: Exclude<Confirm, null>): void => {
    if (kind === 'dataset') {
      sim.reset();
      void qc.invalidateQueries();
      toast.success(t('settings.data.datasetReset'));
    } else if (kind === 'wallet') {
      resetWallet();
      toast.success(t('demo.walletReset'));
    } else {
      for (const [key] of STORAGE_KEYS) window.localStorage.removeItem(key);
      window.location.reload();
    }
    setConfirm(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('navigation.settings')} description={t('settings.description')} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Section id="set-appearance" title={t('settings.appearance.title')} description={t('settings.appearance.description')}>
          <Row label={t('theme.label')}>
            <Segmented
              aria-label={t('theme.label')}
              value={ui.theme}
              onChange={(v) => ui.setTheme(v as ThemePreference)}
              options={[
                { value: 'system', label: <span className="inline-flex items-center gap-1.5"><Monitor className="size-3.5" aria-hidden />{t('theme.system')}</span> },
                { value: 'dark', label: <span className="inline-flex items-center gap-1.5"><Moon className="size-3.5" aria-hidden />{t('theme.dark')}</span> },
                { value: 'light', label: <span className="inline-flex items-center gap-1.5"><Sun className="size-3.5" aria-hidden />{t('theme.light')}</span> },
              ]}
            />
          </Row>
          <Row label={t('settings.reduceMotion')} hint={t('settings.reduceMotionHint')} htmlFor="set-motion">
            <Switch id="set-motion" checked={ui.motion === 'reduce'} onCheckedChange={(on) => ui.setMotion(on ? 'reduce' : 'system')} />
          </Row>
          <Row label={t('settings.appearance.compact')} hint={t('settings.appearance.compactHint')} htmlFor="set-compact">
            <Switch id="set-compact" checked={ui.density === 'compact'} onCheckedChange={(on) => ui.setDensity(on ? 'compact' : 'comfortable')} />
          </Row>
        </Section>

        <Section id="set-network" title={t('settings.network.title')} description={t('settings.network.description')}>
          <Row label={t('settings.network.selected')}>
            <Select aria-label={t('settings.network.selected')} className="w-full sm:w-[200px]" value={chain.id} onValueChange={setChain} options={SELECTABLE_CHAINS.map((c) => ({ value: c.id, label: c.name }))} />
          </Row>
          <Row label={t('settings.network.mode')}>
            <Segmented
              aria-label={t('settings.network.mode')}
              value="demo"
              onChange={() => undefined}
              options={[
                { value: 'demo', label: t('settings.network.demo') },
                { value: 'live', label: t('settings.network.live'), ariaLabel: t('settings.network.live') + ' (' + t('settings.network.unavailable') + ')' },
              ]}
            />
          </Row>
          <p className="rounded-lg border border-yellow/25 bg-yellow/8 px-3 py-2 text-[12.5px] leading-relaxed text-fg-2">{t('settings.network.liveUnavailable')}</p>
          {LIVE_REST_URL ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="secondary" className={WRAP} onClick={() => void testConnection()} disabled={probe.state === 'testing'}>
                {probe.state === 'testing' ? t('settings.network.testing') : t('settings.network.test')}
              </Button>
              <p role="status" className={'min-w-0 flex-1 text-[12.5px] ' + (probe.state === 'error' ? 'text-red' : 'text-fg-2')}>
                {probe.text ?? t('settings.network.testHint')}
              </p>
            </div>
          ) : null}
          <dl className="divide-y divide-line rounded-xl border border-line bg-card/40 text-[12.5px]">
            <div className="flex justify-between gap-4 px-3 py-2">
              <dt className="text-fg-3">{t('settings.network.endpoint')}</dt>
              <dd dir="ltr" className="min-w-0 truncate font-medium text-fg">{LIVE_REST_URL ?? t('settings.network.noEndpoint')}</dd>
            </div>
            <div className="flex justify-between gap-4 px-3 py-2">
              <dt className="text-fg-3">{t('settings.network.status')}</dt>
              <dd className="font-medium text-fg">{net ? t('settings.network.statusDemo', { height: fmt.integer(net.height) }) : '…'}</dd>
            </div>
          </dl>
        </Section>
      </div>

      <Section id="set-language" title={t('settings.language.title')} description={t('settings.language.description')}>
        <p className="text-[13px] text-fg-2">
          {t('settings.language.current')}: <strong className="font-semibold text-fg" lang={current.code}>{current.nativeName}</strong> <span className="text-fg-3">({current.name})</span>
        </p>
        <LanguageList autoFocus={false} wide />
        <p className="text-[12px] leading-relaxed text-fg-3">
          {t('settings.language.fallback')} {t('settings.language.count', { shipped: availableLanguages.length, total: LANGUAGES.length })}
        </p>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section id="set-data" title={t('settings.data.title')} description={t('settings.data.description')}>
          <Row label={t('settings.data.refresh')} hint={t('settings.data.refreshHint')}>
            <Segmented
              aria-label={t('settings.data.refresh')}
              size="sm"
              value={ui.refresh}
              onChange={(v) => ui.setRefresh(v as RefreshPreference)}
              options={(['live', 'slow', 'manual'] as const).map((r) => ({ value: r, label: t('settings.data.refreshOptions.' + r) }))}
            />
          </Row>
          <Row label={t('demo.speed')} hint={t('settings.data.speedHint')}>
            <Segmented aria-label={t('demo.speed')} size="sm" value={speed} onChange={sim.setSpeed} options={SIM_SPEEDS.map((s) => ({ value: s, label: t('demo.speeds.' + s) }))} />
          </Row>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" size="sm" className={WRAP} onClick={() => setConfirm('dataset')}>
              {t('settings.data.resetDataset')}
            </Button>
            <Button variant="secondary" size="sm" className={WRAP} onClick={() => setConfirm('wallet')}>
              {t('demo.resetWallet')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className={WRAP}
              onClick={() => {
                clearSearches();
                toast.success(t('settings.data.searchesCleared'));
              }}
            >
              {t('search.clearRecent')}
            </Button>
          </div>
        </Section>

        <Section id="set-privacy" title={t('settings.privacy.title')} description={t('settings.privacy.description')}>
          <ul className="list-disc space-y-1.5 ps-5 text-[12.5px] leading-relaxed text-fg-2">
            <li>{t('settings.privacy.storage')}</li>
            <li>{t('settings.privacy.wallet')}</li>
            <li>{t('settings.privacy.noSeed')}</li>
            <li>{t('settings.privacy.noNetwork')}</li>
          </ul>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-[12px]">
              <caption className="sr-only">{t('settings.privacy.keysCaption')}</caption>
              <tbody>
                {STORAGE_KEYS.map(([key, label]) => (
                  <tr key={key} className="border-t border-line first:border-0">
                    <th scope="row" dir="ltr" className="whitespace-nowrap px-3 py-2 text-start font-mono font-normal text-fg-2">{key}</th>
                    <td className="px-3 py-2 text-fg-3">{t('settings.' + label)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="danger" size="sm" className={WRAP} onClick={() => setConfirm('all')}>
            {t('settings.privacy.clearAll')}
          </Button>
        </Section>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent title={t('settings.confirm.title')} description={confirm ? t('settings.confirm.' + confirm) : undefined} size="sm">
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">{t('common.cancel')}</Button>
            </DialogClose>
            <Button variant="danger" onClick={() => confirm && run(confirm)}>
              {t('settings.confirm.action')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
