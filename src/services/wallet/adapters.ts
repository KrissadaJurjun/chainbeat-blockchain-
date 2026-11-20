import { bech32Encode } from '@/lib/bech32';
import { randomBytes, rngFor } from '@/lib/prng';
import type { ChainConfig } from '@/types/domain';
import { WalletError, type WalletAccount, type WalletAdapter, type WalletId } from './types';

/**
 * The Demo wallet's "key" is a constant seed, so the same demo identity gets a valid bech32 address on
 * every chain (`cosmos1…`, `osmo1…`) — exactly how one real key maps to many chains. It is not a real
 * account and controls nothing.
 */
export function deriveDemoAddress(chain: ChainConfig): string {
  return bech32Encode(chain.bech32Prefix, randomBytes(rngFor('chainbeat-demo-wallet'), 20));
}

export const demoAdapter: WalletAdapter = {
  id: 'demo',
  name: 'Demo wallet',
  simulated: true,
  isAvailable: () => true,
  connect: async (chain): Promise<WalletAccount> => ({
    address: deriveDemoAddress(chain),
    label: 'Demo wallet',
    chainId: chain.chainId,
  }),
};

/** The subset of the Keplr / Leap injected API that ChainBeat uses (both extensions expose it). */
interface InjectedCosmosWallet {
  enable(chainIds: string | string[]): Promise<void>;
  getKey(chainId: string): Promise<{ name: string; bech32Address: string }>;
}

function injected(id: 'keplr' | 'leap'): InjectedCosmosWallet | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as Record<string, InjectedCosmosWallet | undefined>)[id];
}

function classify(message: string): WalletError['code'] {
  if (/reject|denied|declin|cancel/i.test(message)) return 'rejected';
  if (/chain|network|not\s+support|unknown/i.test(message)) return 'unsupported-chain';
  return 'unknown';
}

export function createInjectedAdapter(id: 'keplr' | 'leap', name: string): WalletAdapter {
  return {
    id,
    name,
    simulated: false,
    isAvailable: () => injected(id) !== undefined,
    connect: async (chain): Promise<WalletAccount> => {
      const wallet = injected(id);
      if (!wallet) throw new WalletError('not-installed', `${name} extension not detected`);
      try {
        await wallet.enable(chain.chainId);
        const key = await wallet.getKey(chain.chainId);
        return { address: key.bech32Address, label: key.name, chainId: chain.chainId };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new WalletError(classify(message), message);
      }
    },
  };
}

export const WALLET_ADAPTERS: readonly WalletAdapter[] = [demoAdapter, createInjectedAdapter('keplr', 'Keplr'), createInjectedAdapter('leap', 'Leap')];

export function getAdapter(id: WalletId): WalletAdapter {
  return WALLET_ADAPTERS.find((a) => a.id === id) ?? demoAdapter;
}
