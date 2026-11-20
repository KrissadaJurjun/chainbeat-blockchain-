import { useState } from 'react';
import { CircleAlert, FlaskConical, KeyRound, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { DemoBadge } from '@/components/ui/Demo';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import { useSimulationActions } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { cn, DAY_MS, HOUR_MS } from '@/lib/utils';
import { WALLET_ADAPTERS } from '@/services/wallet/adapters';
import type { WalletAdapter } from '@/services/wallet/types';
import { useChain } from '@/stores/chainStore';
import { SIM_SPEEDS, getSimAheadMs, getSimNow, useSimStore } from '@/stores/simStore';
import { toast } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import { useWalletStore } from '@/stores/walletStore';
import { GlobalSearch } from '@/components/search/GlobalSearch';

/* ───────────────────────── wallet ───────────────────────── */

function WalletRow({ adapter, busy, onConnect }: { adapter: WalletAdapter; busy: boolean; onConnect: () => void }) {
  const { t } = useTranslation();
  const available = adapter.isAvailable();
  return (
    <li>
      <button
        type="button"
        disabled={!available || busy}
        onClick={onConnect}
        className={cn(
          'surface-row flex w-full items-center gap-3.5 px-3.5 py-3 text-start disabled:cursor-not-allowed disabled:opacity-55',
          available && 'hover:bg-hover',
        )}
      >
        <span className="icon-tile size-10">{adapter.simulated ? <FlaskConical className="size-5 text-yellow" aria-hidden /> : <Wallet className="size-5 text-cyan" aria-hidden />}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
            {adapter.simulated ? t('wallet.demoWallet') : adapter.name}
            {adapter.simulated ? <DemoBadge /> : null}
          </span>
          <span className="mt-0.5 block text-[12px] leading-snug text-fg-3">
            {adapter.simulated ? t('wallet.demoDescription') : available ? t('wallet.extensionDetected', { name: adapter.name }) : t('wallet.extensionMissing', { name: adapter.name })}
          </span>
        </span>
      </button>
    </li>
  );
}

function WalletDialog() {
  const { t } = useTranslation();
  const chain = useChain();
  const closeDialog = useUiStore((s) => s.closeDialog);
  const status = useWalletStore((s) => s.status);
  const error = useWalletStore((s) => s.error);
  const connect = useWalletStore((s) => s.connect);
  const clearError = useWalletStore((s) => s.clearError);

  return (
    <DialogContent title={t('wallet.connectTitle')} description={t('wallet.connectDescription', { chain: chain.name })} size="md">
      <ul className="space-y-2.5">
        {WALLET_ADAPTERS.map((adapter) => (
          <WalletRow
            key={adapter.id}
            adapter={adapter}
            busy={status === 'connecting'}
            onConnect={async () => {
              const ok = await connect(adapter.id, chain);
              if (ok) {
                closeDialog();
                toast.success(adapter.simulated ? t('wallet.demoConnected') : t('wallet.walletConnected', { name: adapter.name }));
              }
            }}
          />
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red/30 bg-red/10 px-3 py-2.5 text-[12.5px] text-red">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t(`wallet.errors.${error.code}`)}
            <button type="button" onClick={clearError} className="ms-2 underline">
              {t('common.dismiss')}
            </button>
          </span>
        </p>
      ) : null}
      <p className="mt-4 flex items-start gap-2.5 rounded-lg border border-line bg-card/50 px-3 py-2.5 text-[12px] leading-relaxed text-fg-3">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-fg-2" aria-hidden />
        {t('wallet.safetyNote')}
      </p>
    </DialogContent>
  );
}

/* ───────────────────────── demo controls ───────────────────────── */

const LATENCY_OPTIONS = [0, 120, 280, 900] as const;

function DemoControlsDialog() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const chain = useChain();
  const actions = useSimulationActions();
  const speed = useSimStore((s) => s.speed);
  useSimStore((s) => s.anchorSim); // re-render when the clock is moved
  const aheadMs = getSimAheadMs();
  const latencyMs = useSimStore((s) => s.latencyMs);
  const forceError = useSimStore((s) => s.forceError);
  const setLatency = useSimStore((s) => s.setLatency);
  const resetDemo = useWalletStore((s) => s.resetDemo);
  const nearestLatency = LATENCY_OPTIONS.reduce((a, b) => (Math.abs(b - latencyMs) < Math.abs(a - latencyMs) ? b : a));

  return (
    <DialogContent title={t('demo.controls')} description={t('demo.controlsIntro')} size="md">
      <div className="space-y-5">
        <section aria-labelledby="demo-clock">
          <h3 id="demo-clock" className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-fg-3">
            {t('demo.clock')}
          </h3>
          <p className="mb-2.5 text-[13px] text-fg-2">
            {t('demo.simulatedNow')}: <strong className="font-semibold text-fg">{fmt.dateTime(getSimNow())}</strong>
            {Math.abs(aheadMs) >= HOUR_MS / 2 ? (
              <span className="ms-2 text-fg-3">
                ({t(aheadMs > 0 ? 'demo.offset' : 'demo.behind', { value: fmt.number(Math.abs(Math.round(aheadMs / HOUR_MS))) })})
              </span>
            ) : null}
          </p>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-fg-2">{t('demo.speed')}</span>
            <Segmented
              aria-label={t('demo.speed')}
              size="sm"
              value={speed}
              onChange={actions.setSpeed}
              options={SIM_SPEEDS.map((s) => ({ value: s, label: t('demo.speeds.' + s) }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => actions.advance(HOUR_MS)}>
              {t('demo.advanceHour')}
            </Button>
            <Button size="sm" onClick={() => actions.advance(DAY_MS)}>
              {t('demo.advanceDay')}
            </Button>
            <Button size="sm" variant="ghost" onClick={actions.reset}>
              {t('demo.resetClock')}
            </Button>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-fg-3">{t('demo.clockNote', { chain: chain.name })}</p>
        </section>

        <section aria-labelledby="demo-net">
          <h3 id="demo-net" className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-fg-3">
            {t('demo.network')}
          </h3>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-fg-2">{t('demo.latency')}</span>
            <Segmented
              aria-label={t('demo.latency')}
              size="sm"
              value={String(nearestLatency)}
              onChange={(v) => setLatency(Number(v))}
              options={LATENCY_OPTIONS.map((ms) => ({ value: String(ms), label: ms === 0 ? t('demo.latencyOff') : `${ms} ms` }))}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <label htmlFor="demo-errors" className="text-[13px] text-fg-2">
              {t('demo.simulateErrors')}
              <span className="block text-[12px] text-fg-3">{t('demo.simulateErrorsHint')}</span>
            </label>
            <Switch id="demo-errors" checked={forceError} onCheckedChange={actions.setForceError} />
          </div>
        </section>

        <section aria-labelledby="demo-wallet">
          <h3 id="demo-wallet" className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-fg-3">
            {t('demo.wallet')}
          </h3>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              resetDemo();
              toast.success(t('demo.walletReset'));
            }}
          >
            {t('demo.resetWallet')}
          </Button>
        </section>
      </div>
    </DialogContent>
  );
}

/* ───────────────────────── mobile search ───────────────────────── */

function SearchDialog() {
  const { t } = useTranslation();
  const closeDialog = useUiStore((s) => s.closeDialog);
  return (
    <DialogContent title={t('search.label')} hideTitle size="md" className="min-h-[300px]">
      <GlobalSearch variant="inline" autoFocus onDone={closeDialog} />
    </DialogContent>
  );
}

/** All app-level dialogs, driven by `uiStore.dialog` so any component can open them. */
export function GlobalDialogs() {
  const dialog = useUiStore((s) => s.dialog);
  const closeDialog = useUiStore((s) => s.closeDialog);
  // Keep the last-open dialog mounted during the close animation.
  const [last, setLast] = useState(dialog);
  if (dialog && dialog !== last) setLast(dialog);
  const shown = dialog ?? last;

  return (
    <Dialog open={dialog !== null} onOpenChange={(open) => !open && closeDialog()}>
      {shown === 'wallet' ? <WalletDialog /> : null}
      {shown === 'demo' ? <DemoControlsDialog /> : null}

      {shown === 'search' ? <SearchDialog /> : null}
    </Dialog>
  );
}
