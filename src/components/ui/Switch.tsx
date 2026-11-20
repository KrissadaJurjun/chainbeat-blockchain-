import type { ComponentProps } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full border border-line-strong bg-card transition-colors data-[state=checked]:border-cyan/60 data-[state=checked]:bg-cyan/30 disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-[3px] rounded-full bg-fg-2 transition-transform duration-150 data-[state=checked]:translate-x-[21px] data-[state=checked]:bg-fg rtl:-translate-x-[3px] rtl:data-[state=checked]:-translate-x-[21px]" />
    </SwitchPrimitive.Root>
  );
}
