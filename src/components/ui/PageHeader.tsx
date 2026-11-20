import type { ReactNode } from 'react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
}

/** Page-level heading. Also sets the browser tab title. */
export function PageHeader({ title, description, actions, badge }: PageHeaderProps) {
  useDocumentTitle(title);
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-[20px] font-bold leading-tight text-fg sm:text-[22px] 2xl:text-[23px]">{title}</h1>
          {badge}
        </div>
        {description ? <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-fg-2 2xl:text-[13.5px]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
