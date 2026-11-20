import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { useId } from 'react';
import { useFormat } from '@/hooks/useFormat';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { HistoryPoint } from '@/types/domain';
import { AXIS_LINE, AXIS_TICK, ChartTooltip, GRID_STROKE } from './ChartTooltip';

interface HistoryChartProps {
  data: readonly HistoryPoint[];
  /** Series name shown in the tooltip. */
  name: string;
  /** Format a value for the axis and the tooltip. */
  format: (v: number) => string;
  color?: string;
  height?: number;
  /** Y-axis domain; defaults to the data range. */
  domain?: [number | 'auto' | 'dataMin', number | 'auto' | 'dataMax'];
}

/** A small time-series area chart (left-to-right canvas) that follows the theme and the reduced-motion setting. */
export function HistoryChart({ data, name, format, color = 'var(--c-cyan)', height = 180, domain }: HistoryChartProps) {
  const fmt = useFormat();
  const reduced = useReducedMotion();
  const id = useId().replace(/:/g, '');
  return (
    <div style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height }}>
        <AreaChart data={data as HistoryPoint[]} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={'hc-' + id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity={0.3} />
              <stop offset="1" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v: number) => fmt.date(v, { month: 'short', day: 'numeric' })} minTickGap={36} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} domain={domain ?? ['auto', 'auto']} tickFormatter={(v: number) => format(v)} />
          <RTooltip content={<ChartTooltip labelFormatter={(l) => fmt.date(Number(l), { dateStyle: 'medium' })} valueFormatter={(v) => format(Number(v))} />} />
          <Area type="monotone" dataKey="v" name={name} stroke={color} strokeWidth={2} fill={'url(#hc-' + id + ')'} isAnimationActive={!reduced} animationDuration={450} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
