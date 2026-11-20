import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { DemoNotice } from '@/components/ui/Demo';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { notify } from '@/lib/notify';
import { useSimStore } from '@/stores/simStore';
import { toast } from '@/stores/toastStore';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: ReactNode;
  rows: ReadonlyArray<readonly [label: string, value: ReactNode]>;
  confirmLabel?: string;
  onConfirm: () => void;
}

/**
 * The "review, then confirm or cancel" step every Demo wallet action goes through. It repeats, in words, that the
 * action is simulated: no transfer, no signature, no broadcast.
 */
export function TransactionConfirmDialog({ open, onOpenChange, title, description, rows, confirmLabel, onConfirm }: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title ?? t('wallet.confirm.title')} description={description} size="sm">
        <dl className="divide-y divide-line rounded-xl border border-line bg-card/40 text-[12.5px]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 px-3 py-2">
              <dt className="shrink-0 text-fg-3">{label}</dt>
              <dd className="min-w-0 break-words text-end font-medium tabular-nums text-fg">{value}</dd>
            </div>
          ))}
        </dl>
        <DemoNotice bare className="mt-3">
          {t('wallet.confirm.demoNotice')}
        </DemoNotice>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">{t('common.cancel')}</Button>
          </DialogClose>
          <Button
            variant="primary"
            onClick={() => {
              // Demo controls → "Simulate network errors": a confirmation then fails like a rejected broadcast, changing nothing
              if (useSimStore.getState().forceError) {
                toast.error(t('wallet.confirm.failedTitle'), t('wallet.confirm.failedBody'));
                notify.txFailed();
                onOpenChange(false);
                return;
              }
              onConfirm();
            }}
          >
            {confirmLabel ?? t('wallet.confirm.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
