import { useMemo } from 'react';
import { isDemoTxHash } from '@/lib/demoTx';
import { useChain } from '@/stores/chainStore';
import { useWalletStore } from '@/stores/walletStore';
import type { Tx } from '@/types/domain';
import { useTransaction } from './useChainData';

/** Transactions the Demo wallet created on the selected network, newest first. */
export function useDemoTxs(): Tx[] {
  const chain = useChain();
  const activity = useWalletStore((s) => s.ledger.activity);
  return useMemo(() => activity.flatMap((a) => (a.tx && a.tx.from.startsWith(chain.bech32Prefix + '1') ? [a.tx] : [])), [activity, chain.bech32Prefix]);
}

/** A transaction by hash: the Demo wallet's own record when the hash is one of theirs, otherwise the simulated chain. */
export function useTransactionView(hash: string) {
  const activity = useWalletStore((s) => s.ledger.activity);
  const mine = isDemoTxHash(hash) ? activity.find((a) => a.tx?.hash.toUpperCase() === hash.toUpperCase())?.tx : undefined;
  const query = useTransaction(hash, !mine);
  return mine
    ? { data: mine as Tx | null | undefined, isLoading: false, isError: false, isFetching: false, refetch: query.refetch, isDemo: true as const }
    : { data: query.data, isLoading: query.isLoading, isError: query.isError, isFetching: query.isFetching, refetch: query.refetch, isDemo: false as const };
}
