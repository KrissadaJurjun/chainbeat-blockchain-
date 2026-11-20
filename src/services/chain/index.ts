import { demoProvider } from './demoProvider';
import type { ChainDataProvider } from './provider';

/**
 * The active data provider. Swap this one line (or make it depend on a setting) to introduce a live
 * Cosmos REST/RPC provider that implements `ChainDataProvider`.
 */
export const provider: ChainDataProvider = demoProvider;

export type { ChainDataProvider } from './provider';
export { SimulatedNetworkError } from './provider';
export { CHAINS, SELECTABLE_CHAINS, ASSETS, getChain, getAsset } from './registry';
