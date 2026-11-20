import type { ReactNode } from 'react';
import { Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWalletAddress } from '@/components/layout/WalletButton';
import { Button } from '@/components/ui/Button';
import { DemoNotice } from '@/components/ui/Demo';
import { EmptyState } from '@/components/ui/Feedback';
import { Panel } from '@/components/ui/Panel';
import { shortHash } from '@/lib/utils';
import { useChainStore, useChain } from '@/stores/chainStore';
import { toast } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import { useWalletStore } from '@/stores/walletStore';

export interface WalletState {
  connected: boolean;
  isDemo: boolean;
  address: string | null;
}

export function useWalletState(): WalletState {
  const status = useWalletStore((s) => s.status);
  const adapterId = useWalletStore((s) => s.adapterId);
  const address = useWalletAddress();
  return { connected: status === 'connected', isDemo: status === 'connected' && adapterId === 'demo', address };
}

/** Connect the simulated Demo wallet for the selected network and confirm it to the user. */
export function useConnectDemo(): () => Promise<void> {
  const { t } = useTranslation();
  const chain = useChain();
  const connect = useWalletStore((s) => s.connect);
  return async () => {
    if (await connect('demo', chain)) toast.success(t('wallet.demoConnected'));
  };
}

/**
 * Wallet workflows (swap, stake, send, vote…) are simulated, so they run against the Demo wallet only.
 * This gate explains that clearly and offers a one-click way to connect it.
 */
export function WalletGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { connected, isDemo, address } = useWalletState();
  const openDialog = useUiStore((s) => s.openDialog);
  const connectDemo = useConnectDemo();
  useChainStore((s) => s.chainId); // re-render on network change so the derived address stays current

  if (isDemo) return <>{children}</>;

  return (
    <Panel>
      <EmptyState
        icon={Wallet}
        title={connected ? t('gate.realTitle') : t('gate.title')}
        description={connected && address ? t('gate.realBody', { address: shortHash(address, 8, 6) }) : t('gate.body')}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => void connectDemo()}>
              {t('gate.useDemo')}
            </Button>
            {!connected ? (
              <Button variant="secondary" onClick={() => openDialog('wallet')}>
                {t('wallet.connect')}
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="px-5 pb-5">
        <DemoNotice />
      </div>
    </Panel>
  );
}
