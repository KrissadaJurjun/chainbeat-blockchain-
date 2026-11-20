import type { ReactNode } from 'react';

interface PayloadItem {
  name?: string | number;
  value?: number | string | ReadonlyArray<number | string>;
  color?: string;
  stroke?: string;
  fill?: string;
  payload?: { fill?: string } & Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<PayloadItem>;
  label?: string | number;
  labelFormatter?: (label: string | number | undefined) => ReactNode;
  valueFormatter?: (value: number | string, name: string) => ReactNode;
}

/** Tooltip used by every Recharts chart so they share one look (and follow the theme). */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="glass-pop pointer-events-none rounded-xl px-3 py-2.5 text-[12px]">
      {label !== undefined && label !== '' ? <p className="mb-1.5 text-[11.5px] text-fg-3">{labelFormatter ? labelFormatter(label) : label}</p> : null}
      <ul className="space-y-1">
        {payload.map((item, i) => {
          const raw = Array.isArray(item.value) ? item.value[0] : item.value;
          const name = String(item.name ?? '');
          const color = item.color ?? item.stroke ?? item.fill ?? item.payload?.fill;
          return (
            <li key={`${name}-${i}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-fg-2">
                {color ? <i className="size-2 rounded-full" style={{ background: color }} /> : null}
                {name}
              </span>
              <span className="font-semibold tabular-nums text-fg">{valueFormatter ? valueFormatter(raw as number | string, name) : String(raw)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Shared axis / grid styling so charts follow the active theme. */
export const AXIS_TICK = { fill: 'var(--c-fg-3)', fontSize: 11 } as const;
export const GRID_STROKE = 'var(--c-line)';
export const AXIS_LINE = { stroke: 'var(--c-line-strong)' } as const;
