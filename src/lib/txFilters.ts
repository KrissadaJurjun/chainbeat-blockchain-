import { txGroup, TX_GROUPS, type TxGroup } from '@/lib/txView';
import type { Tx, TxStatus } from '@/types/domain';

export type StatusFilter = 'all' | TxStatus;
export const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'success', 'failed'];

export interface TxFilters {
  /** Free text: hash, address, or block height. */
  q: string;
  group: 'all' | TxGroup;
  status: StatusFilter;
  /** `YYYY-MM-DD` (UTC): list the latest transactions up to the end of that day. Empty = up to now. */
  date: string;
}

export const EMPTY_TX_FILTERS: TxFilters = { q: '', group: 'all', status: 'all', date: '' };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Read the filters from a URL query string, ignoring anything that is not a valid value. */
export function parseTxFilters(params: URLSearchParams): TxFilters {
  const group = params.get('group');
  const status = params.get('status');
  const date = params.get('date') ?? '';
  return {
    q: params.get('q') ?? '',
    group: group && (TX_GROUPS as readonly string[]).includes(group) ? (group as TxGroup) : 'all',
    status: status && (STATUS_FILTERS as readonly string[]).includes(status) ? (status as StatusFilter) : 'all',
    date: DATE.test(date) && !Number.isNaN(Date.parse(date + 'T00:00:00Z')) ? date : '',
  };
}

export const hasActiveTxFilters = (f: TxFilters): boolean => f.q.trim() !== '' || f.group !== 'all' || f.status !== 'all' || f.date !== '';

/** Last millisecond of a `YYYY-MM-DD` day in UTC, or null when the date is empty/invalid. */
export function endOfDayUtc(date: string): number | null {
  if (!DATE.test(date)) return null;
  const start = Date.parse(date + 'T00:00:00Z');
  return Number.isNaN(start) ? null : start + 86_400_000 - 1;
}

/** Apply the text, category and status filters (the date filter selects which transactions are fetched). */
export function filterTxs(txs: readonly Tx[], f: TxFilters): Tx[] {
  const needle = f.q.trim().toLowerCase();
  return txs.filter(
    (x) =>
      (f.group === 'all' || txGroup(x.type) === f.group) &&
      (f.status === 'all' || x.status === f.status) &&
      (!needle || x.hash.toLowerCase().includes(needle) || x.from.toLowerCase().includes(needle) || (x.to ?? '').toLowerCase().includes(needle) || String(x.height) === needle),
  );
}

/** Rows for a CSV download of transactions: header first, then one row per transaction (ISO timestamps, raw amounts). */
export function txCsvRows(txs: readonly Tx[], headers: readonly string[]): Array<Array<string | number>> {
  return [
    [...headers],
    ...txs.map((x) => [x.hash, x.height, x.type, x.status, x.from, x.to ?? '', x.amount, x.symbol, x.feeAmount, x.feeSymbol, new Date(x.time).toISOString(), x.memo]),
  ];
}
