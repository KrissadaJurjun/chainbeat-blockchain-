import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/storage';
import { DEFAULT_CHAIN_ID, getChain, isSelectableChain } from '@/services/chain/registry';
import type { ChainConfig } from '@/types/domain';

interface ChainState {
  chainId: string;
  setChain: (id: string) => void;
}

export const useChainStore = create<ChainState>()(
  persist(
    (set) => ({
      chainId: isSelectableChain(DEFAULT_CHAIN_ID) ? DEFAULT_CHAIN_ID : 'cosmoshub',
      setChain: (id) => {
        if (isSelectableChain(id)) set({ chainId: id });
      },
    }),
    {
      name: 'chainbeat.chain',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      // A persisted id that is no longer selectable falls back to the default.
      merge: (persisted, current) => {
        const id = (persisted as Partial<ChainState> | undefined)?.chainId;
        return { ...current, chainId: id && isSelectableChain(id) ? id : current.chainId };
      },
    },
  ),
);

/** The currently selected network's static configuration. */
export function useChain(): ChainConfig {
  return getChain(useChainStore((s) => s.chainId));
}
