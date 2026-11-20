import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const inputClass =
  'h-10 w-full rounded-[10px] border border-line-strong bg-card/60 px-3 text-[13px] text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-3 hover:border-active-line focus-visible:border-cyan focus-visible:ring-2 focus-visible:ring-cyan/30 aria-[invalid=true]:border-red aria-[invalid=true]:ring-red/20 disabled:opacity-50';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(inputClass, 'h-auto min-h-[96px] resize-y py-2.5 leading-relaxed', className)} {...props} />;
}

interface FieldProps {
  label: ReactNode;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  /** Optional element rendered at the end of the label row (e.g. a balance / "Max" button). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label + control + validation message, wired for assistive tech via `aria-describedby` ids. */
export function Field({ label, htmlFor, error, hint, aside, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {/* wraps when a long label and the aside ("Balance: … Max") do not fit on one line; the aside then stays at the end */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor={htmlFor} className="text-[12px] font-medium text-fg-2">
          {label}
        </label>
        {aside ? <div className="ms-auto">{aside}</div> : null}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-[12px] text-red">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[12px] text-fg-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Helper to build the aria props for a control inside a <Field>. */
export function fieldAria(id: string, error?: string, hasHint = false): { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string } {
  return {
    id,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  };
}
