import type { ComponentType, ReactNode } from 'react';
import { CircleAlert, Inbox, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Heading level for the title; pages whose whole content is this empty state use `h1`. */
  titleAs?: 'p' | 'h1' | 'h2';
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className, titleAs: Title = 'p' }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div role="status" className={cn('flex flex-col items-center justify-center gap-2 px-4 py-10 text-center', className)}>
      <span className="icon-tile size-11">
        <Icon className="size-5 text-fg-2" />
      </span>
      <Title className="font-display text-[14px] font-semibold text-fg">{title ?? t('states.emptyTitle')}</Title>
      <p className="max-w-[340px] text-[12.5px] leading-relaxed text-fg-3">{description ?? t('states.emptyBody')}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function ErrorState({ title, description, onRetry, retrying, className }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-2 px-4 py-10 text-center', className)}>
      <span className="icon-tile size-11 !border-red/30">
        <CircleAlert className="size-5 text-red" aria-hidden />
      </span>
      <p className="font-display text-[14px] font-semibold text-fg">{title ?? t('states.errorTitle')}</p>
      <p className="max-w-[360px] text-[12.5px] leading-relaxed text-fg-3">{description ?? t('states.errorBody')}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry} loading={retrying}>
          {!retrying ? <RefreshCw className="size-3.5" aria-hidden /> : null}
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
}
