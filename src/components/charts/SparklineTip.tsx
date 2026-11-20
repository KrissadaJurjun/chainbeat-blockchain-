import { useState, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import { Sparkline } from './Sparkline';

interface SparklineTipProps {
  values: readonly number[];
  /** Label for each point (a day, a week …) shown above its value. */
  labels?: readonly string[];
  format: (value: number) => string;
  color?: string;
  height?: number;
  fade?: boolean;
  area?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** A sparkline that shows the value under the pointer (mouse, pen or touch) in a small tooltip. */
export function SparklineTip({ values, labels, format, className, height = 30, ...rest }: SparklineTipProps) {
  const [hover, setHover] = useState<number | null>(null);
  const move = (e: PointerEvent<HTMLDivElement>): void => {
    const box = e.currentTarget.getBoundingClientRect();
    const ratio = box.width > 0 ? (e.clientX - box.left) / box.width : 0;
    setHover(Math.max(0, Math.min(values.length - 1, Math.round(ratio * (values.length - 1)))));
  };
  const value = hover === null ? undefined : values[hover];
  return (
    <div className={cn('relative', className)} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)}>
      <Sparkline values={values} height={height} {...rest} />
      {hover !== null && value !== undefined ? (
        <>
          <span className="pointer-events-none absolute top-0 h-full w-px bg-fg-3/50" style={{ left: (hover / Math.max(1, values.length - 1)) * 100 + '%' }} aria-hidden />
          <span
            role="status"
            className="glass-pop pointer-events-none absolute -top-1 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md px-2 py-1 text-[11px] tabular-nums text-fg"
            style={{ left: Math.min(88, Math.max(12, (hover / Math.max(1, values.length - 1)) * 100)) + '%' }}
          >
            {labels?.[hover] ? <span className="me-1.5 text-fg-3">{labels[hover]}</span> : null}
            {format(value)}
          </span>
        </>
      ) : null}
    </div>
  );
}
