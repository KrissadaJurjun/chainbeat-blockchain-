import type { ComponentProps } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ───────────── dropdown menu ───────────── */

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export function DropdownMenuContent({ className, sideOffset = 8, align = 'end', ...props }: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={10}
        className={cn('glass-pop cb-pop z-[90] min-w-[200px] rounded-xl p-1.5 text-[13px] text-fg', className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

const itemClass =
  'relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-fg-2 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-hover data-[highlighted]:text-fg';

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return <DropdownMenuPrimitive.Item className={cn(itemClass, className)} {...props} />;
}

export function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem className={cn(itemClass, 'pe-8 data-[state=checked]:text-fg', className)} {...props}>
      {children}
      <DropdownMenuPrimitive.ItemIndicator className="absolute end-2.5 grid place-items-center text-cyan">
        <Check className="size-4" aria-hidden />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return <DropdownMenuPrimitive.Label className={cn('px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className={cn('-mx-1.5 my-1.5 h-px bg-line', className)} {...props} />;
}

/* ───────────── popover ───────────── */

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({ className, sideOffset = 8, align = 'end', ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={10}
        className={cn('glass-pop cb-pop z-[90] w-[320px] max-w-[calc(100vw-20px)] rounded-2xl text-[13px] text-fg outline-none', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
