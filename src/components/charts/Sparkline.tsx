import { useId } from 'react';
import { monotonePath } from '@/lib/chart';
import { cn } from '@/lib/utils';

interface SparklineProps {
  values: readonly number[];
  /** Any CSS colour, e.g. `var(--c-cyan)`. */
  color?: string;
  height?: number;
  strokeWidth?: number;
  /** Fill the area under the line with a soft gradient. */
  area?: boolean;
  /** Fade the line's ends (the look of the reference's repository charts). */
  fade?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** A tiny responsive line chart. Stretches to its container width; stroke width stays constant. */
export function Sparkline({ values, color = 'var(--c-cyan)', height = 32, strokeWidth = 1.7, area, fade, className, ...rest }: SparklineProps) {
  const id = useId().replace(/:/g, '');
  const W = 100;
  const pad = strokeWidth + 1;
  if (values.length < 2) return <svg className={cn('w-full', className)} height={height} aria-hidden />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, height - pad - ((v - min) / span) * (height - pad * 2)] as const);
  const line = monotonePath(pts);
  const labelled = rest['aria-label'];

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className={cn('block overflow-visible', className)}
      role={labelled ? 'img' : undefined}
      aria-label={labelled}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      <defs>
        {area ? (
          <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        ) : null}
        {fade ? (
          <linearGradient id={`${id}-f`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={color} stopOpacity="0.15" />
            <stop offset="0.25" stopColor={color} stopOpacity="1" />
            <stop offset="0.8" stopColor={color} stopOpacity="1" />
            <stop offset="1" stopColor={color} stopOpacity="0.5" />
          </linearGradient>
        ) : null}
      </defs>
      {area ? <path d={`${line}L${W} ${height}L0 ${height}Z`} fill={`url(#${id}-a)`} /> : null}
      <path d={line} fill="none" stroke={fade ? `url(#${id}-f)` : color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
