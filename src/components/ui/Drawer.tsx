import type { ComponentProps, ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

interface DrawerContentProps extends Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
}

/**
 * A side sheet that slides in from the END edge (right in left-to-right languages, left in right-to-left ones).
 * Same Radix behaviour as a dialog: focus trap, Escape to close, focus returns to the trigger.
 */
export function DrawerContent({ title, description, className, children, ...props }: DrawerContentProps) {
  const { t } = useTranslation();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="cb-overlay fixed inset-0 z-[80] bg-[var(--c-overlay)] backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn('cb-drawer glass-pop fixed inset-y-0 end-0 z-[81] flex w-[min(480px,100vw)] flex-col border-s border-line-strong', className)}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-3.5 pt-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="font-display text-[16px] font-semibold text-fg">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="mt-1 text-[12.5px] leading-relaxed text-fg-2">{description}</DialogPrimitive.Description> : null}
          </div>
          <DialogPrimitive.Close
            aria-label={t('common.close')}
            className="-me-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-fg-2 transition-colors hover:bg-hover hover:text-fg"
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
