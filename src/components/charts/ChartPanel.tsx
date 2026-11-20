import type { ReactNode } from 'react';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { cn } from '@/lib/utils';

interface ChartPanelProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Chart canvas height in px. */
  height?: number;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  children: ReactNode;
  className?: string;
  /** Screen-reader summary for the chart region. */
  label?: string;
}

/** Titled panel with a fixed-height, left-to-right chart canvas and uniform loading / error states. */
export function ChartPanel({ title, description, actions, height = 280, loading, error, onRetry, children, className, label }: ChartPanelProps) {
  return (
    <Panel className={cn('p-4', className)}>
      <PanelHeader title={title} subtitle={description} actions={actions} />
      <div className="mt-3" style={{ height }} dir="ltr" role={label ? 'img' : undefined} aria-label={label}>
        {loading ? <Skeleton className="h-full w-full" /> : error ? <ErrorState onRetry={onRetry} /> : children}
      </div>
    </Panel>
  );
}
