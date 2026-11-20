import type { ReactNode } from 'react';
import { FlaskConical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/** Small "DEMO" chip. Everything simulated in the app is marked with it. */
export function DemoBadge({ className, label }: { className?: string; label?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn('inline-flex h-[22px] items-center gap-1 rounded-full border border-yellow/30 bg-yellow/12 px-2 text-[10.5px] font-semibold uppercase tracking-wider text-yellow', className)}>
      <FlaskConical className="size-3" aria-hidden />
      {label ?? t('common.demo')}
    </span>
  );
}

/** A clear, persistent explanation shown wherever a workflow is simulated. */
export function DemoNotice({ children, className, bare }: { children?: ReactNode; className?: string; /** Omit the "Demo Mode." lead-in because the message already says it. */ bare?: boolean }) {
  const { t } = useTranslation();
  return (
    <div role="note" className={cn('flex items-start gap-3 rounded-xl border border-yellow/25 bg-yellow/8 px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-2', className)}>
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-yellow" aria-hidden />
      <p>
        {bare ? null : <strong className="font-semibold text-fg">{t('demo.noticeTitle')} </strong>}
        {children ?? t('demo.noticeBody')}
      </p>
    </div>
  );
}
