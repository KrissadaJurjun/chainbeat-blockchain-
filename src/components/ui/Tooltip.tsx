import type { ReactElement, ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <TooltipPrimitive.Provider delayDuration={250} skipDelayDuration={400}>
    {children}
  </TooltipPrimitive.Provider>
);

interface TipProps {
  label: ReactNode;
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Disable (e.g. show tips only when the sidebar is collapsed). */
  disabled?: boolean;
}

/** Hover / focus tooltip. The trigger must be a single focusable element. */
export function Tip({ label, children, side = 'top', align = 'center', disabled }: TipProps) {
  if (disabled || !label) return children;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={7}
          collisionPadding={10}
          className="glass-pop cb-pop z-[120] max-w-[260px] rounded-lg px-2.5 py-1.5 text-[12px] leading-snug text-fg"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
