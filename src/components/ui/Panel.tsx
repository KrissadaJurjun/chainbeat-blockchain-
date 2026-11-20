import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The standard dark dashboard surface (rounded, bordered, gradient). */
export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('panel', className)} {...props} />;
}

interface PanelHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Optional heading id so a region can be labelled by it. */
  id?: string;
  className?: string;
}

/** Title block + actions. Wraps (actions drop below the title) on very narrow screens instead of overlapping. */
export function PanelHeader({ title, subtitle, actions, id, className }: PanelHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-x-3 gap-y-2', className)}>
      <div className="min-w-0">
        <h2 id={id} className="font-display text-[15px] font-semibold leading-tight text-fg">
          {title}
        </h2>
        {subtitle ? <div className="mt-1 text-[12px] text-fg-3">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex max-w-full shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
    </header>
  );
}
