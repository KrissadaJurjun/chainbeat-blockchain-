import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bech32Decode } from '@/lib/bech32';
import { WALLET_ADAPTERS, deriveDemoAddress } from '@/services/wallet/adapters';
import { WalletError } from '@/services/wallet/types';
import { getChain } from '@/services/chain/registry';
import { useChainStore } from './chainStore';
import { getSimNow, useSimStore } from './simStore';
import { toast, useToastStore } from './toastStore';
import { useUiStore } from './uiStore';
import { useWalletStore } from './walletStore';

const persisted = (key: string): { state: Record<string, unknown> } | null => {
  const raw = window.localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as { state: Record<string, unknown> }) : null;
};

describe('uiStore', () => {
  it('persists the sidebar, sections, theme and favourites but never transient UI', () => {
    const s = useUiStore.getState();
    s.toggleSidebar();
    s.toggleSection('wallet');
    s.setTheme('light');
    s.toggleFavorite('osmosis');
    s.setMobileNavOpen(true);
    s.openDialog('wallet');
    const saved = persisted('chainbeat.ui')?.state ?? {};
    expect(saved.sidebarCollapsed).toBe(true);
    expect(saved.theme).toBe('light');
    expect(saved.sectionsOpen).toEqual({ wallet: false });
    expect(saved.favorites).toEqual(['cosmoshub']);
    expect(saved).not.toHaveProperty('mobileNavOpen');
    expect(saved).not.toHaveProperty('dialog');
  });

  it('sections default to open and toggle independently', () => {
    const { toggleSection } = useUiStore.getState();
    expect(useUiStore.getState().sectionsOpen.analytics ?? true).toBe(true);
    toggleSection('analytics');
    expect(useUiStore.getState().sectionsOpen.analytics).toBe(false);
    toggleSection('analytics');
    expect(useUiStore.getState().sectionsOpen.analytics).toBe(true);
  });
});

describe('chainStore', () => {
  it('only accepts networks that are selectable in the sidebar', () => {
    useChainStore.getState().setChain('osmosis');
    expect(useChainStore.getState().chainId).toBe('osmosis');
    useChainStore.getState().setChain('celestia'); // registered, but not selectable yet
    useChainStore.getState().setChain('does-not-exist');
    expect(useChainStore.getState().chainId).toBe('osmosis');
    useChainStore.getState().setChain('cosmoshub');
  });
});

describe('simStore', () => {
  it('advancing and resetting the simulated clock moves getSimNow()', () => {
    const before = getSimNow();
    useSimStore.getState().advance(3_600_000);
    expect(getSimNow() - before).toBeGreaterThanOrEqual(3_600_000);
    expect(getSimNow() - before).toBeLessThan(3_700_000);
    useSimStore.getState().reset();
    expect(useSimStore.getState().anchorSim).toBeNull();
  });

  it('pausing freezes the simulated clock and a slower speed makes it tick at a fifth of real time', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_800_000_000_000);
      useSimStore.getState().reset();
      useSimStore.getState().setSpeed('paused');
      const frozen = getSimNow();
      vi.advanceTimersByTime(60_000);
      expect(getSimNow()).toBe(frozen);

      useSimStore.getState().setSpeed('slow');
      vi.advanceTimersByTime(100_000);
      expect(getSimNow() - frozen).toBe(20_000); // 100 s of real time = 20 s simulated

      useSimStore.getState().setSpeed('normal');
      const resumed = getSimNow();
      vi.advanceTimersByTime(5_000);
      expect(getSimNow() - resumed).toBe(5_000); // switching speed never jumps the clock
    } finally {
      useSimStore.getState().reset();
      vi.useRealTimers();
    }
  });

  it('forced errors are never persisted', () => {
    useSimStore.getState().setForceError(true);
    expect(persisted('chainbeat.sim')?.state).not.toHaveProperty('forceError');
  });
});

describe('toastStore', () => {
  beforeEach(() => useToastStore.setState({ toasts: [] }));
  it('keeps at most four toasts and can dismiss one', () => {
    for (let i = 0; i < 7; i++) toast.show(`t${i}`);
    expect(useToastStore.getState().toasts).toHaveLength(4);
    const id = useToastStore.getState().toasts[0]!.id;
    useToastStore.getState().dismiss(id);
    expect(useToastStore.getState().toasts).toHaveLength(3);
  });
});

describe('wallet adapters', () => {
  it('derive one demo identity with a valid, chain-specific address on every network', () => {
    const hub = deriveDemoAddress(getChain('cosmoshub'));
    const osmo = deriveDemoAddress(getChain('osmosis'));
    expect(hub.startsWith('cosmos1')).toBe(true);
    expect(osmo.startsWith('osmo1')).toBe(true);
    expect(bech32Decode(hub)?.bytes).toEqual(bech32Decode(osmo)?.bytes); // same key, different prefix
    expect(deriveDemoAddress(getChain('cosmoshub'))).toBe(hub); // stable
  });

  it('exposes Demo, Keplr and Leap; only the demo wallet is flagged simulated', () => {
    expect(WALLET_ADAPTERS.map((a) => [a.id, a.simulated])).toEqual([['demo', true], ['keplr', false], ['leap', false]]);
  });

  it('refuses to "connect" a missing extension instead of pretending to', async () => {
    const keplr = WALLET_ADAPTERS.find((a) => a.id === 'keplr')!;
    expect(keplr.isAvailable()).toBe(false);
    await expect(keplr.connect(getChain('cosmoshub'))).rejects.toMatchObject({ code: 'not-installed' });
    const ok = await useWalletStore.getState().connect('keplr', getChain('cosmoshub'));
    expect(ok).toBe(false);
    expect(useWalletStore.getState().status).toBe('disconnected');
    expect(useWalletStore.getState().error?.code).toBe('not-installed');
  });

  it('classifies extension errors (declined, unsupported chain)', async () => {
    const w = window as unknown as Record<string, unknown>;
    const keplr = WALLET_ADAPTERS.find((a) => a.id === 'keplr')!;
    w.keplr = { enable: vi.fn().mockRejectedValue(new Error('Request rejected')), getKey: vi.fn() };
    await expect(keplr.connect(getChain('cosmoshub'))).rejects.toMatchObject({ code: 'rejected' });
    w.keplr = { enable: vi.fn().mockRejectedValue(new Error('There is no chain info for cosmoshub-4')), getKey: vi.fn() };
    await expect(keplr.connect(getChain('cosmoshub'))).rejects.toBeInstanceOf(WalletError);
    delete w.keplr;
  });

  it('a real extension connection is NOT remembered across reloads; the demo wallet is', async () => {
    const w = window as unknown as Record<string, unknown>;
    w.keplr = { enable: vi.fn().mockResolvedValue(undefined), getKey: vi.fn().mockResolvedValue({ name: 'My Key', bech32Address: deriveDemoAddress(getChain('cosmoshub')) }) };
    expect(await useWalletStore.getState().connect('keplr', getChain('cosmoshub'))).toBe(true);
    expect(useWalletStore.getState().adapterId).toBe('keplr');
    expect(persisted('chainbeat.wallet')?.state).not.toHaveProperty('adapterId');
    delete w.keplr;

    await useWalletStore.getState().connect('demo', getChain('cosmoshub'));
    expect(persisted('chainbeat.wallet')?.state.adapterId).toBe('demo');
  });
});

describe('walletStore — demo ledger', () => {
  it('never lets a balance go negative and rounds floating-point dust', () => {
    const s = useWalletStore.getState();
    s.adjustBalance('ATOM', -999_999);
    expect(useWalletStore.getState().ledger.balances.ATOM).toBe(0);
    s.adjustBalance('ATOM', 0.1);
    s.adjustBalance('ATOM', 0.2);
    expect(useWalletStore.getState().ledger.balances.ATOM).toBe(0.3);
  });

  it('merges repeat delegations to one validator and drops emptied ones', () => {
    const s = useWalletStore.getState();
    s.addDelegation({ chainId: 'cosmoshub', validator: 'v1', moniker: 'Aurora Works', amount: 10 });
    s.addDelegation({ chainId: 'cosmoshub', validator: 'v1', moniker: 'Aurora Works', amount: 5 });
    expect(useWalletStore.getState().ledger.delegations).toHaveLength(1);
    expect(useWalletStore.getState().ledger.delegations[0]?.amount).toBe(15);
    s.removeDelegation('cosmoshub', 'v1', 15);
    expect(useWalletStore.getState().ledger.delegations).toHaveLength(0);
  });

  it('records bounded, newest-first activity and can reset to the starting balances', () => {
    const s = useWalletStore.getState();
    for (let i = 0; i < 60; i++) s.record('send', { i });
    expect(useWalletStore.getState().ledger.activity.length).toBeLessThanOrEqual(40);
    s.adjustBalance('OSMO', -1);
    s.resetDemo();
    expect(useWalletStore.getState().ledger.balances.OSMO).toBe(8400);
    expect(useWalletStore.getState().ledger.activity).toHaveLength(0);
  });

  it('keeps one proposal draft, in this browser only, until it is cleared or the demo is reset', () => {
    const draft = { chainId: 'cosmoshub', type: 'other' as const, title: 'A draft title', description: 'x'.repeat(50), deposit: '500', recipient: '', spend: '', votingDays: '7' };
    expect(useWalletStore.getState().ledger.draft).toBeNull();
    useWalletStore.getState().saveDraft(draft);
    expect(useWalletStore.getState().ledger.draft).toMatchObject(draft);
    expect(useWalletStore.getState().ledger.draft?.savedAt).toBeGreaterThan(0);
    expect((persisted('chainbeat.wallet')?.state.ledger as { draft: { title: string } }).draft.title).toBe('A draft title');
    // saving again replaces it: there is never more than one
    useWalletStore.getState().saveDraft({ ...draft, title: 'A newer draft title' });
    expect(useWalletStore.getState().ledger.draft?.title).toBe('A newer draft title');
    useWalletStore.getState().clearDraft();
    expect(useWalletStore.getState().ledger.draft).toBeNull();
    useWalletStore.getState().saveDraft(draft);
    useWalletStore.getState().resetDemo();
    expect(useWalletStore.getState().ledger.draft).toBeNull();
  });

  it('remembers the voting period chosen for a demo proposal', () => {
    const created = useWalletStore.getState().addProposal(getChain('cosmoshub'), { title: 'Short vote', description: 'x', type: 'other', deposit: 600, votingDays: 3 }, getSimNow());
    expect(created.votingDays).toBe(3);
    expect(useWalletStore.getState().ledger.proposals[0]).toMatchObject({ id: created.id, votingDays: 3, type: 'other' });
  });
});
