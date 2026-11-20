import type { ChainConfig } from '@/types/domain';

export type WalletId = 'demo' | 'keplr' | 'leap';

export interface WalletAccount {
  address: string;
  label: string;
  /** Network identifier the wallet was asked to connect to (e.g. `cosmoshub-4`). */
  chainId: string;
}

export type WalletErrorCode = 'not-installed' | 'rejected' | 'unsupported-chain' | 'unknown';

export class WalletError extends Error {
  readonly code: WalletErrorCode;
  constructor(code: WalletErrorCode, message: string) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
  }
}

/**
 * A wallet integration. UI code depends only on this interface, never on a specific extension API, so
 * further wallets (or CosmJS-based signers / EVM providers) can be added without touching components.
 *
 * NOTE: adapters only expose identity (address + label). ChainBeat never requests signatures, never
 * broadcasts transactions and never sees keys — see docs/SECURITY.md.
 */
export interface WalletAdapter {
  readonly id: WalletId;
  readonly name: string;
  /** True for the built-in Demo wallet: no extension, no keys, nothing real. */
  readonly simulated: boolean;
  isAvailable(): boolean;
  connect(chain: ChainConfig): Promise<WalletAccount>;
}
