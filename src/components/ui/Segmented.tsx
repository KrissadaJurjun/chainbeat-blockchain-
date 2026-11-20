import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  'aria-label': string;
  size?: 'sm' | 'md';
  className?: string;
}

/** A radio-group styled as a segmented control, with roving tabindex and arrow-key navigation. */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', className, ...rest }: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const idx = options.findIndex((o) => o.value === value);
    const rtl = document.documentElement.dir === 'rtl';
    let next: number;
    if (e.key === 'ArrowRight') next = idx + (rtl ? -1 : 1);
    else if (e.key === 'ArrowLeft') next = idx + (rtl ? 1 : -1);
    else if (e.key === 'ArrowDown') next = idx + 1;
    else if (e.key === 'ArrowUp') next = idx - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    else return;
    e.preventDefault();
    next = (next + options.length) % options.length;
    const target = options[next];
    if (target) {
      onChange(target.value);
      refs.current[next]?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={rest['aria-label']}
      onKeyDown={onKeyDown}
      className={cn('inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-[10px] border border-line bg-card/50 p-0.5', className)}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.ariaLabel}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-lg font-medium tabular-nums transition-colors duration-150',
              size === 'sm' ? 'h-6 px-2.5 text-[11px]' : 'h-7 px-3 text-[12px] 2xl:h-[30px] 2xl:px-3.5 2xl:text-[13px]',
              checked ? 'bg-active text-fg shadow-[inset_0_0_0_1px_var(--c-active-line)]' : 'text-fg-3 hover:text-fg',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
