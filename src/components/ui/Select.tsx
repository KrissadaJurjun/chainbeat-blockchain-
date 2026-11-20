import type { ComponentProps, ReactNode } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  'aria-label'?: string;
  id?: string;
  className?: string;
  /** Visual density. `ghost` is the borderless variant used inside panel headers. */
  variant?: 'field' | 'ghost';
  disabled?: boolean;
  invalid?: boolean;
}

/** Accessible single-select (Radix) styled to match inputs. */
export function Select({ value, onValueChange, options, placeholder, id, className, variant = 'field', disabled, invalid, ...rest }: SelectProps) {
  // The accessible name must contain the visible text (WCAG 2.5.3 Label in Name): "Asset: ATOM".
  const selected = options.find((o) => o.value === value);
  const visible = typeof selected?.label === 'string' ? selected.label : undefined;
  const accessibleName = rest['aria-label'] ? (visible ? `${rest['aria-label']}: ${visible}` : rest['aria-label']) : undefined;
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={accessibleName}
        aria-invalid={invalid || undefined}
        className={cn(
          'inline-flex items-center justify-between gap-2 text-[13px] text-fg outline-none transition-colors data-[placeholder]:text-fg-3 disabled:opacity-50',
          variant === 'field'
            ? 'h-10 w-full rounded-[10px] border border-line-strong bg-card/60 px-3 hover:border-active-line focus-visible:border-cyan focus-visible:ring-2 focus-visible:ring-cyan/30 aria-[invalid=true]:border-red'
            : 'h-8 rounded-lg px-2 text-fg-2 hover:bg-hover hover:text-fg',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-fg-3" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={10}
          className="glass-pop cb-pop z-[95] max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl text-[13px] text-fg"
        >
          <SelectPrimitive.Viewport className="p-1.5">
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </SelectItem>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function SelectItem({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-lg py-2 pe-8 ps-2.5 text-[13px] text-fg-2 outline-none data-[disabled]:opacity-45 data-[highlighted]:bg-hover data-[highlighted]:text-fg data-[state=checked]:text-fg',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute end-2.5 text-cyan">
        <Check className="size-4" aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
