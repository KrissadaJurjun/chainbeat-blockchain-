import { paths } from '@/lib/paths';
import { useNotificationStore } from '@/stores/notificationStore';
import { getSimNow } from '@/stores/simStore';
import type { AppNotification } from '@/types/domain';

type Draft = Omit<AppNotification, 'id' | 'time' | 'params'> & { params?: AppNotification['params'] };
const push = ({ params = {}, ...rest }: Draft): void => useNotificationStore.getState().push({ ...rest, params, time: getSimNow() });

/**
 * Local, event-driven notifications. Each one is stored as a message KEY plus parameters, so switching language
 * re-translates the whole list, and each one says what it is (a simulation, a local browser event) — none of them is
 * ever presented as a live blockchain alert.
 */
export const notify = {
  walletConnected: (demo: boolean, name: string): void =>
    push({ kind: 'wallet', tone: 'success', messageKey: demo ? 'notifications.items.walletConnectedDemo' : 'notifications.items.walletConnected', params: { name }, href: paths.portfolio }),
  walletDisconnected: (): void => push({ kind: 'wallet', tone: 'info', messageKey: 'notifications.items.walletDisconnected', href: paths.portfolio }),
  txSuccess: (activityKind: string, activityParams: Record<string, string | number>, txHash?: string): void =>
    push({
      kind: 'tx',
      tone: 'success',
      messageKey: 'notifications.items.txSuccess',
      nested: { key: `wallet.activity.${activityKind}`, params: activityParams, as: 'summary' },
      href: txHash ? paths.tx(txHash) : paths.portfolio,
    }),
  txFailed: (): void => push({ kind: 'tx', tone: 'error', messageKey: 'notifications.items.txFailed', href: paths.settings }),
  proposalCreated: (title: string, id: number): void => push({ kind: 'proposal', tone: 'success', messageKey: 'notifications.items.proposalCreated', params: { title, id }, href: paths.proposal(id) }),
  networkChanged: (chain: string): void => push({ kind: 'network', tone: 'info', messageKey: 'notifications.items.networkChanged', params: { chain }, href: paths.dashboard }),
  warning: (messageKey: string, params?: AppNotification['params']): void => push({ kind: 'warning', tone: 'warning', messageKey, params, href: paths.settings }),
};
