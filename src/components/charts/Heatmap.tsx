import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormat } from '@/hooks/useFormat';
import { cn } from '@/lib/utils';
import type { DevDay } from '@/types/domain';

interface HeatmapProps {
  weeks: readonly (readonly DevDay[])[];
  /** Show only the most recent N weeks. */
  limitWeeks?: number;
  /** Weekdays only (Mon–Fri) — the compact 5-row look used on the dashboard. */
  weekdaysOnly?: boolean;
  className?: string;
  cellClassName?: string;
}

const LEVEL_VAR = ['var(--c-heat-0)', 'var(--c-heat-1)', 'var(--c-heat-2)', 'var(--c-heat-3)', 'var(--c-heat-4)'] as const;

interface Tip {
  x: number;
  y: number;
  index: string;
}

/**
 * Contribution heat map (GitHub-style). The grid is one image with a text summary for assistive technology.
 * Hovering (or touching) a cell shows a tooltip with the exact date and count: ONE pointer handler on the grid
 * looks the cell up, so hundreds of cells never carry their own listeners or state.
 */
export function Heatmap({ weeks, limitWeeks, weekdaysOnly, className, cellClassName }: HeatmapProps) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const { columns, total, rows } = useMemo(() => {
    const sliced = limitWeeks ? weeks.slice(-limitWeeks) : weeks;
    const cols = sliced.map((w) => {
      const byDow = new Map(w.map((d) => [new Date(d.date).getUTCDay(), d] as const));
      const order = weekdaysOnly ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
      return order.map((dow) => byDow.get(dow) ?? null);
    });
    return { columns: cols, total: sliced.flat().reduce((a, d) => a + d.count, 0), rows: weekdaysOnly ? 5 : 7 };
  }, [weeks, limitWeeks, weekdaysOnly]);

  const onMove = (e: PointerEvent<HTMLDivElement>): void => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
    const box = wrap.current?.getBoundingClientRect();
    if (!cell || !box) return setTip(null);
    const index = cell.dataset.cell as string;
    setTip((prev) => (prev?.index === index ? prev : { index, x: e.clientX - box.left, y: e.clientY - box.top }));
  };

  const [tc, tr] = tip ? tip.index.split('-').map(Number) : [0, 0];
  const hovered = tip ? columns[tc as number]?.[tr as number] : null;

  return (
    <div ref={wrap} className="relative" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setTip(null)}>
      <div
        role="img"
        aria-label={t('dev.heatmapLabel', { total: fmt.integer(total), weeks: columns.length })}
        className={cn('grid gap-[3px]', className)}
        style={{ gridTemplateColumns: 'repeat(' + columns.length + ', minmax(0, 1fr))', gridTemplateRows: 'repeat(' + rows + ', minmax(0, 1fr))', gridAutoFlow: 'column' }}
      >
        {columns.flatMap((col, c) =>
          col.map((day, r) => (
            <span
              key={c + '-' + r}
              data-cell={day ? c + '-' + r : undefined}
              className={cn('aspect-square min-h-[7px] rounded-[3px]', cellClassName)}
              style={{ background: day ? LEVEL_VAR[day.level] : 'transparent' }}
            />
          )),
        )}
      </div>
      {tip && hovered ? (
        <div
          role="status"
          className="glass-pop pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11.5px]"
          style={{ left: Math.min(Math.max(tip.x, 70), (wrap.current?.clientWidth ?? 200) - 70), top: tip.y }}
        >
          <b className="tabular-nums text-fg">{t('dev.cellTitle', { count: hovered.count, date: fmt.date(hovered.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) })}</b>
        </div>
      ) : null}
    </div>
  );
}

/** Legend: Less ▢▢▢▢▢ More. */
export function HeatmapLegend({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex items-center gap-1.5 text-[11px] text-fg-3', className)} aria-hidden="true">
      <span>{t('dev.less')}</span>
      {LEVEL_VAR.map((c) => (
        <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} />
      ))}
      <span>{t('dev.more')}</span>
    </div>
  );
}
