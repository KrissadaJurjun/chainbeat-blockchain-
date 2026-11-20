import { useEffect } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useToastStore, type Toast, type ToastTone } from '@/stores/toastStore';

const ICONS: Record<ToastTone, typeof Info> = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert };
const TONES: Record<ToastTone, string> = { info: 'text-cyan', success: 'text-green', warning: 'text-yellow', error: 'text-red' };

function ToastItem({ toast }: { toast: Toast }) {
  const { t } = useTranslation();
  const dismiss = useToastStore((s) => s.dismiss);
  const Icon = ICONS[toast.tone];

  useEffect(() => {
    if (!toast.duration) return;
    const id = window.setTimeout(() => dismiss(toast.id), toast.duration);
    return () => window.clearTimeout(id);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <li className="pointer-events-auto">
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className="glass-pop cb-pop flex w-full items-start gap-3 rounded-xl p-3.5"
    >
      <Icon className={cn('mt-0.5 size-[18px] shrink-0', TONES[toast.tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-fg">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 text-[12.5px] leading-snug text-fg-2">{toast.description}</p> : null}
      </div>
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={() => dismiss(toast.id)}
        className="-me-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-md text-fg-3 hover:bg-hover hover:text-fg"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
    </li>
  );
}

/** The corner where transient messages appear. Each message is its own `status` / `alert` live region. */
export function Toaster() {
  const { t } = useTranslation();
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div role="region" aria-label={t('notifications.label')} className="pointer-events-none fixed inset-x-3 bottom-3 z-[130] ms-auto max-w-[380px] sm:inset-x-auto sm:end-5 sm:bottom-5 sm:w-[380px]">
      <ol className="flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </ol>
    </div>
  );
}
