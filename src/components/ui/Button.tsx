import type { ComponentProps } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand border border-white/15 text-white shadow-[0_8px_20px_-10px_var(--c-brand)] hover:brightness-110',
        secondary: 'border border-line-strong bg-card/60 text-fg hover:border-active-line hover:bg-hover',
        ghost: 'border border-transparent text-fg-2 hover:bg-hover hover:text-fg',
        danger: 'border border-red/35 bg-red/12 text-red hover:bg-red/20',
        outline: 'border border-line-strong text-fg-2 hover:bg-hover hover:text-fg',
      },
      size: {
        sm: 'h-8 px-3 text-[12px]',
        md: 'h-9 px-3.5 text-[13px]',
        lg: 'h-11 px-5 text-[14px]',
        icon: 'h-9 w-9 text-[13px]',
        'icon-sm': 'h-8 w-8 text-[12px]',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /** Shows a spinner, sets aria-busy and disables the button. */
  loading?: boolean;
  /** Render the child element (e.g. a router Link) with button styling. */
  asChild?: boolean;
}

export function Button({ className, variant, size, loading, asChild, children, disabled, type, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) return <Slot className={classes} {...props}>{children}</Slot>;
  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin-slow" aria-hidden /> : null}
      {children}
    </button>
  );
}
