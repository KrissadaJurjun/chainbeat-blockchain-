import { useEffect } from 'react';
import { notify } from '@/lib/notify';
import { getChain } from '@/services/chain/registry';
import { useChainStore } from '@/stores/chainStore';
import { useSimStore } from '@/stores/simStore';
import { useWalletStore } from '@/stores/walletStore';

/**
 * Turns things that happen in this browser into bell notifications: wallet connect/disconnect, confirmed simulated
 * transactions, a proposal created in Demo Mode, a network switch, and simulation warnings. It listens to the stores
 * (rather than being called from every page) so no action can forget to notify. Mounted once, by the app shell.
 */
export function useNotificationEvents(): void {
  useEffect(() => {
    const offChain = useChainStore.subscribe((s, prev) => {
      if (s.chainId !== prev.chainId) notify.networkChanged(getChain(s.chainId).name);
    });

    const offWallet = useWalletStore.subscribe((s, prev) => {
      if (s.status === 'connected' && (prev.status !== 'connected' || prev.address !== s.address)) notify.walletConnected(s.adapterId === 'demo', s.label ?? '');
      else if (s.status === 'disconnected' && prev.status === 'connected') notify.walletDisconnected();

      const proposal = s.ledger.proposals[0];
      if (proposal && proposal.key !== prev.ledger.proposals[0]?.key) notify.proposalCreated(proposal.title, proposal.id);

      const latest = s.ledger.activity[0];
      // a drafted proposal already announced itself above
      if (latest && latest.id !== prev.ledger.activity[0]?.id && latest.kind !== 'proposal') notify.txSuccess(latest.kind, latest.params, latest.tx?.hash);
    });

    const offSim = useSimStore.subscribe((s, prev) => {
      if (s.speed !== prev.speed && s.speed === 'paused') notify.warning('notifications.items.simPaused');
      if (s.forceError && !prev.forceError) notify.warning('notifications.items.errorSimulation');
    });

    return () => {
      offChain();
      offWallet();
      offSim();
    };
  }, []);
}
