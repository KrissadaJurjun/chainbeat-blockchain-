import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/storage';
import { uid } from '@/lib/utils';
import { getAdapter } from '@/services/wallet/adapters';
import { WalletError, type WalletErrorCode, type WalletId } from '@/services/wallet/types';
import type { ChainConfig, ProposalType, Tx } from '@/types/domain';

export type DemoActivityKind = 'swap' | 'stake' | 'unstake' | 'liquid-stake' | 'send' | 'vote' | 'claim' | 'proposal';

export interface DemoActivity {
  id: string;
  ts: number;
  kind: DemoActivityKind;
  /** Interpolation params for `wallet.activity.<kind>`. */
  params: Record<string, string | number>;
  /** The synthetic transaction this action produced (visible in the explorer, clearly marked as a Demo record). */
  tx?: Tx;
}

export interface DemoDelegation {
  chainId: string;
  validator: string;
  moniker: string;
  amount: number;
  since: number;
}

/** A proposal drafted in Demo Mode. It joins the governance lists on that network but exists only in this browser. */
export interface DemoProposal {
  key: string;
  chainId: string;
  /** Simulated proposal number: continues after the network's last (simulated) proposal. */
  id: number;
  title: string;
  description: string;
  type: ProposalType;
  deposit: number;
  submittedAt: number;
  /** Voting period chosen in the form; the network's own when absent. */
  votingDays?: number;
}

/** The Create Proposal form as the visitor left it ("Save draft"): one draft, restored the next time the page opens. */
export interface ProposalDraft {
  chainId: string;
  type: ProposalType;
  title: string;
  description: string;
  deposit: string;
  recipient: string;
  spend: string;
  votingDays: string;
  savedAt: number;
}

/** Everything the Demo wallet "owns". Lives only in this browser's localStorage and never leaves it. */
export interface DemoLedger {
  balances: Record<string, number>;
  delegations: DemoDelegation[];
  activity: DemoActivity[];
  votes: Record<string, string>;
  proposals: DemoProposal[];
  draft?: ProposalDraft | null;
}

const initialLedger = (): DemoLedger => ({
  balances: { ATOM: 1250, OSMO: 8400, USDC: 540, BTC: 0.0125, stATOM: 0 },
  delegations: [],
  activity: [],
  votes: {},
  proposals: [],
  draft: null,
});

type Status = 'disconnected' | 'connecting' | 'connected';

interface WalletState {
  status: Status;
  adapterId: WalletId | null;
  address: string | null;
  label: string | null;
  walletChainId: string | null;
  error: { code: WalletErrorCode; message: string } | null;
  ledger: DemoLedger;

  connect: (id: WalletId, chain: ChainConfig) => Promise<boolean>;
  disconnect: () => void;
  clearError: () => void;

  adjustBalance: (symbol: string, delta: number) => void;
  record: (kind: DemoActivityKind, params: DemoActivity['params']) => void;
  /** Like `record`, and keeps the synthetic transaction so the explorer can show it. */
  recordTx: (kind: DemoActivityKind, params: DemoActivity['params'], tx: Tx) => void;
  addDelegation: (delegation: Omit<DemoDelegation, 'since'>) => void;
  removeDelegation: (chainId: string, validator: string, amount: number) => void;
  resetRewardClock: (now: number) => void;
  setVote: (key: string, option: string) => void;
  /** Add a simulated proposal on `chain`; returns it (with its simulated number). */
  addProposal: (chain: ChainConfig, proposal: Omit<DemoProposal, 'key' | 'chainId' | 'id' | 'submittedAt'>, now: number) => DemoProposal;
  saveDraft: (draft: Omit<ProposalDraft, 'savedAt'>) => void;
  clearDraft: () => void;
  resetDemo: () => void;
}

const MAX_ACTIVITY = 40;

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      status: 'disconnected',
      adapterId: null,
      address: null,
      label: null,
      walletChainId: null,
      error: null,
      ledger: initialLedger(),

      connect: async (id, chain) => {
        set({ status: 'connecting', error: null });
        try {
          const account = await getAdapter(id).connect(chain);
          set({ status: 'connected', adapterId: id, address: account.address, label: account.label, walletChainId: account.chainId, error: null });
          return true;
        } catch (e) {
          const err = e instanceof WalletError ? e : new WalletError('unknown', e instanceof Error ? e.message : String(e));
          set({ status: 'disconnected', adapterId: null, address: null, label: null, walletChainId: null, error: { code: err.code, message: err.message } });
          return false;
        }
      },
      disconnect: () => set({ status: 'disconnected', adapterId: null, address: null, label: null, walletChainId: null, error: null }),
      clearError: () => set({ error: null }),

      adjustBalance: (symbol, delta) =>
        set((s) => {
          const next = Math.max(0, (s.ledger.balances[symbol] ?? 0) + delta);
          return { ledger: { ...s.ledger, balances: { ...s.ledger.balances, [symbol]: Math.round(next * 1e8) / 1e8 } } };
        }),
      record: (kind, params) =>
        set((s) => ({
          ledger: { ...s.ledger, activity: [{ id: uid('act'), ts: Date.now(), kind, params }, ...s.ledger.activity].slice(0, MAX_ACTIVITY) },
        })),
      recordTx: (kind, params, tx) =>
        set((s) => ({
          ledger: { ...s.ledger, activity: [{ id: uid('act'), ts: tx.time, kind, params, tx }, ...s.ledger.activity].slice(0, MAX_ACTIVITY) },
        })),
      addDelegation: (d) =>
        set((s) => {
          const existing = s.ledger.delegations.find((x) => x.chainId === d.chainId && x.validator === d.validator);
          const delegations = existing
            ? s.ledger.delegations.map((x) => (x === existing ? { ...x, amount: x.amount + d.amount } : x))
            : [...s.ledger.delegations, { ...d, since: Date.now() }];
          return { ledger: { ...s.ledger, delegations } };
        }),
      removeDelegation: (chainId, validator, amount) =>
        set((s) => ({
          ledger: {
            ...s.ledger,
            delegations: s.ledger.delegations
              .map((x) => (x.chainId === chainId && x.validator === validator ? { ...x, amount: x.amount - amount } : x))
              .filter((x) => x.amount > 1e-9),
          },
        })),
      resetRewardClock: (now) => set((s) => ({ ledger: { ...s.ledger, delegations: s.ledger.delegations.map((d) => ({ ...d, since: now })) } })),
      setVote: (key, option) => set((s) => ({ ledger: { ...s.ledger, votes: { ...s.ledger.votes, [key]: option } } })),
      addProposal: (chain, proposal, now) => {
        const existing = get().ledger.proposals.filter((p) => p.chainId === chain.id);
        const created: DemoProposal = { ...proposal, key: uid('prop'), chainId: chain.id, id: chain.proposalsTotal + 1 + existing.length, submittedAt: now };
        set((s) => ({ ledger: { ...s.ledger, proposals: [created, ...s.ledger.proposals].slice(0, 30) } }));
        return created;
      },
      saveDraft: (draft) => set((s) => ({ ledger: { ...s.ledger, draft: { ...draft, savedAt: Date.now() } } })),
      clearDraft: () => set((s) => ({ ledger: { ...s.ledger, draft: null } })),
      resetDemo: () => set({ ledger: initialLedger() }),
    }),
    {
      name: 'chainbeat.wallet',
      version: 2,
      // version 1 kept proposal "drafts"; they were never real proposals, so the migration simply starts the list again
      migrate: (persisted) => {
        const state = persisted as { ledger?: Partial<DemoLedger> & { drafts?: unknown } } | undefined;
        if (state?.ledger) {
          delete state.ledger.drafts;
          state.ledger.proposals ??= [];
        }
        return state as unknown as WalletState;
      },
      storage: createJSONStorage(() => safeStorage),
      // Only the simulated Demo wallet survives a reload. A real extension wallet is never "remembered":
      // the user must approve the connection again, so the UI can never claim a stale connection.
      partialize: (s) => ({
        ledger: s.ledger,
        ...(s.adapterId === 'demo'
          ? { status: 'connected' as Status, adapterId: s.adapterId, address: s.address, label: s.label, walletChainId: s.walletChainId }
          : {}),
      }),
    },
  ),
);

/** True when the connected wallet is the simulated Demo wallet. */
export const useIsDemoWallet = (): boolean => useWalletStore((s) => s.status === 'connected' && s.adapterId === 'demo');
