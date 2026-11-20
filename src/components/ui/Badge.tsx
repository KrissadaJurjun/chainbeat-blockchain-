import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium leading-none 2xl:text-[12px]', {
  variants: {
    tone: {
      neutral: 'border-line-strong bg-card/60 text-fg-2',
      green: 'border-green/30 bg-green/12 text-green',
      red: 'border-red/30 bg-red/12 text-red',
      purple: 'border-purple/30 bg-purple/12 text-purple',
      cyan: 'border-cyan/30 bg-cyan/12 text-cyan',
      yellow: 'border-yellow/30 bg-yellow/12 text-yellow',
      blue: 'border-blue/30 bg-blue/12 text-blue',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
