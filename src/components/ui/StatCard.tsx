import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  loading?: boolean;
  className?: string;
}

/** A compact KPI tile used at the top of analytics pages. */
export function StatCard({ icon: Icon, label, value, hint, loading, className }: StatCardProps) {
  return (
    <div className={cn('metric-card flex items-center gap-3 px-3.5 py-3 2xl:px-4 2xl:py-[11px]', className)}>
      <span className="icon-tile size-10 2xl:size-11">
        <Icon className="size-[18px] 2xl:size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[11.5px] leading-snug text-fg-3 2xl:text-[12.5px] 2xl:leading-4" title={typeof label === 'string' ? label : undefined}>
          {label}
        </p>
        {loading ? <Skeleton className="mt-1 h-6 w-24" /> : <p className="truncate font-display text-[19px] font-bold leading-tight tabular-nums text-fg 2xl:text-[22px] 2xl:leading-6">{value}</p>}
        {hint && !loading ? (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-fg-3 2xl:text-[11.5px] 2xl:leading-4" title={typeof hint === 'string' ? hint : undefined}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
