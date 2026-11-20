import { useEffect, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { ErrorState, EmptyState, Skeleton } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

declare module '@tanstack/react-table' {
  // Per-column presentation hints used by <DataTable>.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: 'start' | 'end' | 'center';
    className?: string;
  }
}

interface DataTableProps<T> {
  data: readonly T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  /** Accessible table name (screen readers). */
  caption: string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  pageSize?: number;
  pageSizes?: number[];
  initialSort?: SortingState;
  /** Free-text filter applied across all filterable columns. */
  globalFilter?: string;
  /** Changing this value sends the table back to page 1 (use when the caller pre-filters `data`). */
  resetPageKey?: string;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  emptyTitle?: ReactNode;
  emptyBody?: ReactNode;
  minWidth?: number;
  className?: string;
}

/**
 * Sortable, filterable, paginated table built on TanStack Table.
 * Wide tables scroll horizontally INSIDE their own container, never the page.
 */
export function DataTable<T>({
  data,
  columns,
  caption,
  loading,
  error,
  onRetry,
  pageSize = 10,
  pageSizes = [10, 25, 50],
  initialSort = [],
  globalFilter,
  resetPageKey,
  onRowClick,
  getRowId,
  emptyTitle,
  emptyBody,
  minWidth = 720,
  className,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

  const table = useReactTable({
    data: data as T[],
    columns,
    state: { sorting, pagination, globalFilter: globalFilter ?? '' },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId,
    autoResetPageIndex: false, // live data refreshes must not bounce the user back to page 1
  });

  useEffect(() => setPagination((p) => ({ ...p, pageIndex: 0 })), [globalFilter, resetPageKey]);

  // If live data shrinks below the current page, fall back to the last page instead of showing nothing.
  const pageCount = table.getPageCount();
  useEffect(() => {
    const last = Math.max(0, pageCount - 1);
    setPagination((p) => (p.pageIndex > last ? { ...p, pageIndex: last } : p));
  }, [pageCount]);

  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const from = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const to = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize);
  const alignClass = (a?: 'start' | 'end' | 'center'): string => (a === 'end' ? 'text-end' : a === 'center' ? 'text-center' : 'text-start');

  const clickable = Boolean(onRowClick);
  const onRowActivate = (e: MouseEvent | KeyboardEvent, row: T): void => {
    if ((e.target as HTMLElement).closest('a,button,input,select,[role=button]')) return; // let inner controls win
    onRowClick?.(row);
  };

  return (
    <div className={className}>
      {/* `relative` matters: sr-only children are position:absolute and would otherwise escape the scroll clip and widen the page */}
      <div className="relative overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-[12.5px]" style={{ minWidth }}>
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-card/60 text-[10.5px] uppercase tracking-wider text-fg-3">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  const align = header.column.columnDef.meta?.align;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : canSort ? 'none' : undefined}
                      className={cn('whitespace-nowrap px-3 py-2.5 font-semibold', alignClass(align), header.column.columnDef.meta?.className)}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn('inline-flex items-center gap-1 rounded uppercase tracking-wider transition-colors hover:text-fg', sorted && 'text-fg', align === 'end' && 'flex-row-reverse')}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : sorted === 'desc' ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: Math.min(pageSize, 8) }, (_, i) => (
                  <tr key={i} className="border-t border-line">
                    <td colSpan={columns.length} className="px-3 py-2">
                      <Skeleton className="h-6" />
                    </td>
                  </tr>
                ))
              : error && rows.length === 0
                ? null
                : rows.map((row) => (
                    <tr
                      key={row.id}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? (e) => onRowActivate(e, row.original) : undefined}
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === 'Enter') onRowActivate(e, row.original);
                            }
                          : undefined
                      }
                      className={cn('border-t border-line transition-colors', clickable && 'cursor-pointer hover:bg-hover/50 focus-visible:bg-hover/50 focus-visible:outline-none')}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className={cn('px-3 py-2.5 align-middle text-fg-2', alignClass(cell.column.columnDef.meta?.align), cell.column.columnDef.meta?.className)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
          </tbody>
        </table>
        {error && rows.length === 0 && !loading ? <ErrorState onRetry={onRetry} /> : null}
        {!loading && !error && rows.length === 0 ? <EmptyState title={emptyTitle} description={emptyBody ?? t('common.noResults')} /> : null}
      </div>

      {total > 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-fg-3">
          <p aria-live="polite">{t('common.showing', { from, to, total })}</p>
          <div className={cn('flex items-center gap-2', table.getPageCount() <= 1 && 'hidden')}>
            <label className="flex items-center gap-2">
              <span className="hidden sm:inline">{t('common.rowsPerPage')}</span>
              <Select
                variant="ghost"
                aria-label={t('common.rowsPerPage')}
                value={String(pagination.pageSize)}
                onValueChange={(v) => setPagination({ pageIndex: 0, pageSize: Number(v) })}
                options={Array.from(new Set([pageSize, ...pageSizes])).sort((a, b) => a - b).map((n) => ({ value: String(n), label: String(n) }))}
              />
            </label>
            <button
              type="button"
              aria-label={t('common.previous')}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              className="grid size-8 place-items-center rounded-lg border border-line text-fg-2 transition-colors hover:bg-hover disabled:opacity-40"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
            </button>
            <span className="min-w-[56px] text-center tabular-nums">
              {pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
            </span>
            <button
              type="button"
              aria-label={t('common.next')}
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              className="grid size-8 place-items-center rounded-lg border border-line text-fg-2 transition-colors hover:bg-hover disabled:opacity-40"
            >
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
