import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionConfirmDialog } from '@/components/wallet/ConfirmDialog';
import { useNotificationEvents } from '@/hooks/useNotificationEvents';
import { DEMO_FEE, makeDemoTx } from '@/lib/demoTx';
import { getChain } from '@/services/chain/registry';
import { useChainStore } from '@/stores/chainStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { getSimNow, useSimStore } from '@/stores/simStore';
import { useToastStore } from '@/stores/toastStore';
import { useWalletStore } from '@/stores/walletStore';
import { connectDemoWallet, renderApp } from '@/test/utils';
import { NotificationsMenu } from './NotificationsMenu';

function Harness() {
  useNotificationEvents();
  return <NotificationsMenu />;
}

const bell = () => screen.getByRole('button', { name: /^(Notifications|\d+ unread notifications?)$/ });
const openBell = async () => {
  await userEvent.setup().click(bell());
  return await screen.findByRole('list', { name: 'Notifications' });
};

describe('notifications', () => {
  beforeEach(() => {
    useNotificationStore.setState({ readIds: [], dismissedIds: [], local: [] });
    useChainStore.getState().setChain('cosmoshub');
    useToastStore.setState({ toasts: [] });
  });

  it('shows the simulated feed with an unread count, and "mark all as read" clears it', async () => {
    const user = userEvent.setup();
    renderApp(<Harness />);
    await waitFor(() => expect(bell()).toHaveAccessibleName(/\d+ unread notifications?/));
    await openBell();
    // the panel says that the feed is simulated
    expect(screen.getByText(/Nothing here is a live blockchain alert/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(bell()).toHaveAccessibleName('Notifications'));
  });

  it('wallet connect/disconnect, a confirmed simulated transaction and a network switch each add one notification', async () => {
    const user = userEvent.setup();
    renderApp(<Harness />);
    await act(async () => connectDemoWallet());
    const hub = getChain('cosmoshub');
    const tx = makeDemoTx(hub, getSimNow(), { type: 'send', from: 'cosmos1sender', to: 'cosmos1receiver', amount: 12, symbol: 'ATOM', seed: 'test-1' });
    act(() => useWalletStore.getState().recordTx('send', { amountAmt: 12, symbol: 'ATOM', to: 'cosmos1receiver' }, tx));
    act(() => useChainStore.getState().setChain('osmosis'));
    act(() => useWalletStore.getState().disconnect());

    const list = await openBell();
    expect(within(list).getByText('Demo wallet connected (simulated).')).toBeInTheDocument();
    expect(within(list).getByText(/Simulated transaction confirmed: Sent 12 ATOM to cosmos1receiver/)).toBeInTheDocument();
    expect(within(list).getByText('Switched to Osmosis. Showing simulated data.')).toBeInTheDocument();
    expect(within(list).getByText('Wallet disconnected from this browser session.')).toBeInTheDocument();

    // dismissing removes just that item
    const dismiss = within(list).getAllByRole('button', { name: 'Dismiss notification' });
    const before = dismiss.length;
    await user.click(dismiss[0] as HTMLElement);
    expect(within(screen.getByRole('list', { name: 'Notifications' })).getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(before - 1);
    // "Clear all" empties the list and shows the empty state
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
  });

  it('a drafted proposal is announced once, with a link to it', async () => {
    renderApp(<Harness />);
    await act(async () => connectDemoWallet());
    act(() => {
      const created = useWalletStore.getState().addProposal(getChain('cosmoshub'), { type: 'text', title: 'Demo idea', description: 'x', deposit: 10, symbol: 'ATOM' } as never, getSimNow());
      useWalletStore.getState().record('proposal', { title: created.title, depositAmt: 10, symbol: 'ATOM' });
    });
    const proposals = useNotificationStore.getState().local.filter((n) => n.kind === 'proposal');
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.href).toMatch(/^\/governance\/proposals\/\d+$/);
    expect(useNotificationStore.getState().local.filter((n) => n.kind === 'tx')).toHaveLength(0);
  });

  it('pausing the simulation and turning on error simulation raise warnings, never alerts about a real network', async () => {
    renderApp(<Harness />);
    act(() => useSimStore.getState().setSpeed('paused'));
    act(() => useSimStore.getState().setForceError(true));
    const local = useNotificationStore.getState().local;
    expect(local.map((n) => n.messageKey).sort()).toEqual(['notifications.items.errorSimulation', 'notifications.items.simPaused']);
    expect(local.every((n) => n.kind === 'warning' && n.tone === 'warning')).toBe(true);
  });
});

describe('simulated transaction failure', () => {
  beforeEach(() => {
    useNotificationStore.setState({ readIds: [], dismissedIds: [], local: [] });
    useToastStore.setState({ toasts: [] });
  });

  it('with error simulation on, confirming fails: nothing is submitted, a toast and a notification explain why', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    useSimStore.setState({ forceError: true });
    renderApp(<TransactionConfirmDialog open onOpenChange={() => undefined} description="d" rows={[['Fee', String(DEMO_FEE)]]} onConfirm={onConfirm} />);
    await user.click(await screen.findByRole('button', { name: 'Confirm (simulated)' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts.at(-1)?.title).toBe('Simulated transaction failed');
    expect(useNotificationStore.getState().local[0]).toMatchObject({ kind: 'tx', tone: 'error', messageKey: 'notifications.items.txFailed' });
  });

  it('with error simulation off, confirming goes through', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderApp(<TransactionConfirmDialog open onOpenChange={() => undefined} description="d" rows={[['Fee', '0']]} onConfirm={onConfirm} />);
    await user.click(await screen.findByRole('button', { name: 'Confirm (simulated)' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(useNotificationStore.getState().local).toHaveLength(0);
  });
});
