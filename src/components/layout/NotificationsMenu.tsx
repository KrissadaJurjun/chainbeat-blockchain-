import { useMemo, useState, type ComponentType } from 'react';
import { Bell, Boxes, FileText, Network, Receipt, Share2, ShieldCheck, TriangleAlert, Vote, Wallet, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DemoBadge } from '@/components/ui/Demo';
import { Skeleton } from '@/components/ui/Feedback';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Menu';
import { Tip } from '@/components/ui/Tooltip';
import { useNotifications } from '@/hooks/useChainData';
import { useFormat } from '@/hooks/useFormat';
import { localiseParams } from '@/lib/activityParams';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notificationStore';
import { getSimNow } from '@/stores/simStore';
import type { AppNotification, NotificationKind, NotificationTone } from '@/types/domain';

const ICONS: Record<NotificationKind, ComponentType<{ className?: string }>> = {
  proposal: Vote,
  validator: ShieldCheck,
  network: Network,
  ibc: Share2,
  block: Boxes,
  tx: Receipt,
  wallet: Wallet,
  warning: TriangleAlert,
};
const TONE: Record<NotificationTone, string> = { info: 'text-fg-2', success: 'text-green', warning: 'text-yellow', error: 'text-red' };

/** The bell: simulated network feed + things that happened in this browser (wallet, simulated transactions, warnings). */
export function NotificationsMenu() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useNotifications();
  const readIds = useNotificationStore((s) => s.readIds);
  const dismissedIds = useNotificationStore((s) => s.dismissedIds);
  const local = useNotificationStore((s) => s.local);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const dismissAll = useNotificationStore((s) => s.dismissAll);

  const items = useMemo(() => [...local, ...(data ?? []).filter((n) => !dismissedIds.includes(n.id))].sort((a, b) => b.time - a.time), [local, data, dismissedIds]);
  const unread = items.filter((n) => !readIds.includes(n.id)).length;
  const ids = items.map((n) => n.id);

  const message = (n: AppNotification): string =>
    t(n.messageKey, { ...localiseParams(n.params, fmt), ...(n.nested ? { [n.nested.as]: t(n.nested.key, localiseParams(n.nested.params, fmt)) } : {}) });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label={t('notifications.label')}>
        <PopoverTrigger
          aria-label={unread > 0 ? t('notifications.unreadLabel', { count: unread }) : t('notifications.label')}
          className="relative grid size-9 place-items-center rounded-[10px] text-fg-2 outline-none transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-cyan/40 data-[state=open]:bg-hover"
        >
          <Bell className="size-[17px]" aria-hidden />
          {unread > 0 ? (
            <span aria-hidden className="absolute end-1 top-1 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-red px-1 text-[9.5px] font-bold leading-none text-[var(--c-canvas)] light:text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </PopoverTrigger>
      </Tip>
      <PopoverContent className="w-[min(372px,calc(100vw-1.5rem))] p-0" align="end">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[14px] font-semibold">{t('notifications.title')}</h2>
            <DemoBadge />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={unread === 0}
              onClick={() => markAllRead(ids)}
              className="text-[12px] font-medium text-cyan transition-opacity hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
            >
              {t('notifications.markAllRead')}
            </button>
            <button
              type="button"
              disabled={items.length === 0}
              onClick={() => dismissAll(ids)}
              className="text-[12px] font-medium text-fg-2 transition-opacity hover:text-fg hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
            >
              {t('notifications.clearAll')}
            </button>
          </div>
        </div>
        <ul className="max-h-[360px] overflow-y-auto p-1.5" aria-label={t('notifications.title')}>
          {isLoading && items.length === 0 ? (
            <li className="space-y-2 p-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </li>
          ) : items.length === 0 ? (
            <li className="px-4 py-8 text-center text-[12.5px] text-fg-3">{t('notifications.empty')}</li>
          ) : (
            items.map((n) => {
              const Icon = ICONS[n.kind];
              const isUnread = !readIds.includes(n.id);
              return (
                <li key={n.id} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                      navigate(n.href);
                    }}
                    className="flex w-full items-start gap-3 rounded-lg py-2.5 pe-9 ps-2.5 text-start transition-colors hover:bg-hover"
                  >
                    <span className="icon-tile mt-0.5 size-8">
                      <Icon className={cn('size-4', TONE[n.tone ?? 'info'])} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block break-words text-[12.5px] leading-snug', isUnread ? 'font-medium text-fg' : 'text-fg-2')}>
                        {isUnread ? <span className="sr-only">{t('notifications.unread')}: </span> : null}
                        {message(n)}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-fg-3">
                        {fmt.relative(n.time, getSimNow())}
                        {isUnread ? <span className="size-1.5 rounded-full bg-cyan" aria-hidden /> : null}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={t('notifications.dismiss')}
                    title={t('notifications.dismiss')}
                    onClick={() => dismiss(n.id)}
                    className="absolute end-1.5 top-2 grid size-6 place-items-center rounded-md text-fg-3 outline-none transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-cyan/40"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <p className="flex items-start gap-2 border-t border-line px-4 py-2.5 text-[11.5px] leading-snug text-fg-3">
          <FileText className="mt-px size-3.5 shrink-0" aria-hidden />
          {t('notifications.simulatedNote')}
        </p>
      </PopoverContent>
    </Popover>
  );
}
