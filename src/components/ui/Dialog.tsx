import type { ComponentProps, ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps extends Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  /** Visually hide the title but keep it for screen readers. */
  hideTitle?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'max-w-[400px]', md: 'max-w-[520px]', lg: 'max-w-[760px]' } as const;

/** Modal dialog with focus trap, Escape-to-close and an accessible title (Radix). */
export function DialogContent({ title, description, hideTitle, size = 'md', className, children, ...props }: DialogContentProps) {
  const { t } = useTranslation();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="cb-overlay fixed inset-0 z-[80] bg-[var(--c-overlay)] backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'cb-pop glass-pop fixed inset-0 z-[81] m-auto flex h-fit max-h-[88dvh] w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl',
          SIZES[size],
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-3.5 pt-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className={cn('font-display text-[16px] font-semibold text-fg', hideTitle && 'sr-only')}>{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-[12.5px] leading-relaxed text-fg-2">{description}</DialogPrimitive.Description>
            ) : null}
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
