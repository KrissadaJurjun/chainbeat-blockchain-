import { cn } from '@/lib/utils';

export interface ChartKeyItem {
  label: string;
  color: string;
  /** `swatch` for filled series (bars, areas); the others sample a line, so lines differ by pattern as well as colour. */
  shape?: 'swatch' | 'solid' | 'dashed' | 'dotted';
}

const DASH = { solid: undefined, dashed: '6 4', dotted: '2 4' } as const;

/** The key of a chart, as text: every colour is paired with a name (and lines with a pattern), never colour alone. */
export function ChartKey({ items, className }: { items: readonly ChartKeyItem[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[12px] text-fg-2', className)}>
      {items.map(({ label, color, shape = 'swatch' }) => (
        <li key={label} className="inline-flex items-center gap-1.5">
          {shape === 'swatch' ? (
            <i className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} aria-hidden />
          ) : (
            <svg width="22" height="8" aria-hidden className="shrink-0">
              <line x1="1" y1="4" x2="21" y2="4" stroke={color} strokeWidth="2.2" strokeDasharray={DASH[shape]} strokeLinecap="round" />
            </svg>
          )}
          {label}
        </li>
      ))}
    </ul>
  );
}
