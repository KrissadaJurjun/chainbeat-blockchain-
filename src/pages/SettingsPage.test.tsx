import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChainStore } from '@/stores/chainStore';
import { useSearchStore } from '@/stores/searchStore';
import { useSimStore } from '@/stores/simStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import { connectDemoWallet, renderApp } from '@/test/utils';
import SettingsPage from './SettingsPage';

const stored = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? 'null') as { state: Record<string, unknown> } | null;

describe('Settings', () => {
  afterEach(() => {
    useUiStore.setState({ theme: 'dark', motion: 'system', density: 'comfortable', refresh: 'live' });
    useChainStore.getState().setChain('cosmoshub');
    vi.restoreAllMocks();
  });

  it('theme, reduced motion, compact layout and refresh are applied and persisted in this browser', async () => {
    const user = userEvent.setup();
    renderApp(<SettingsPage />);
    await user.click(await screen.findByRole('radio', { name: /Light/ }));
    await user.click(screen.getByRole('switch', { name: /Reduce motion/ }));
    await user.click(screen.getByRole('switch', { name: /Compact layout/ }));
    await user.click(within(screen.getByRole('radiogroup', { name: 'Refresh live data' })).getByRole('radio', { name: 'Manual' }));
    expect(useUiStore.getState()).toMatchObject({ theme: 'light', motion: 'reduce', density: 'compact', refresh: 'manual' });
    await waitFor(() => expect(stored('chainbeat.ui')?.state).toMatchObject({ theme: 'light', motion: 'reduce', density: 'compact', refresh: 'manual' }));
  });

  it('switching the network changes the selected chain and the data source line stays "simulated"', async () => {
    const user = userEvent.setup();
    renderApp(<SettingsPage />);
    await user.click(await screen.findByRole('combobox', { name: /^Network/ }));
    await user.click(await screen.findByRole('option', { name: 'Osmosis' }));
    expect(useChainStore.getState().chainId).toBe('osmosis');
    expect(await screen.findByText(/^Simulated network · height/)).toBeInTheDocument();
    expect(screen.getByText('None (simulated data)')).toBeInTheDocument();
    // Live is explained as unavailable rather than offered
    expect(screen.getByText(/Live data is not available in this build/)).toBeInTheDocument();
  });

  it('clears recent searches immediately, and asks before resetting the demo dataset or wallet', async () => {
    const user = userEvent.setup();
    await connectDemoWallet();
    useSearchStore.getState().add({ query: 'cosmos1abc', label: 'cosmos1abc', href: '/explorer/accounts/cosmos1abc', kind: 'address' });
    expect(useSearchStore.getState().recent).toHaveLength(1);
    useSimStore.getState().setSpeed('paused');
    renderApp(<SettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'Clear recent searches' }));
    expect(useSearchStore.getState().recent).toEqual([]);
    expect(useToastStore.getState().toasts.at(-1)?.title).toBe('Recent searches cleared.');

    await user.click(screen.getByRole('button', { name: 'Reset demo dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Are you sure?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(useSimStore.getState().speed).toBe('paused'); // cancelled: nothing happened
    await user.click(screen.getByRole('button', { name: 'Reset demo dataset' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Are you sure?' })).getByRole('button', { name: 'Confirm' }));
    expect(useSimStore.getState().speed).toBe('normal');
  });

  it('states what is stored, what the wallet exposes and that no seed phrase is ever requested', async () => {
    renderApp(<SettingsPage />);
    const privacy = await screen.findByRole('heading', { name: 'Privacy' });
    const section = privacy.closest('section, div') as HTMLElement;
    expect(within(section.parentElement as HTMLElement).getByText(/seed phrase|recovery phrase/i)).toBeInTheDocument();
    for (const key of ['chainbeat.lang', 'chainbeat.ui', 'chainbeat.wallet', 'chainbeat.notifications']) expect(screen.getByText(key)).toBeInTheDocument();
  });
});
