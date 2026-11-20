import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Panel } from '@/components/ui/Panel';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/utils';
import { DemoInbox } from './DemoInbox';

interface AuthCardProps {
  /** The page heading (`h1`); it also becomes the browser tab title. */
  title: string;
  description?: ReactNode;
  /** "Step 2 of 3" line above the heading. */
  step?: { current: number; total: number };
  /** Change it when a multi-step flow moves on, and keyboard / screen-reader focus follows to the new heading. */
  focusKey?: string;
  children: ReactNode;
  /** Links below the form ("New here? Create an account"). */
  footer?: ReactNode;
  className?: string;
}

/** The card every sign-in page is built from. */
export function AuthCard({ title, description, step, focusKey, children, footer, className }: AuthCardProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useDocumentTitle(title);

  useEffect(() => {
    if (first.current) {
      first.current = false; // the page load itself is announced by the route announcer
      return;
    }
    heading.current?.focus();
  }, [focusKey]);

  return (
    <Panel aria-labelledby={headingId} className={cn('p-5 sm:p-6', className)}>
      {step ? <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-wider text-fg-3">{t('auth.steps.label', step)}</p> : null}
      <h1 id={headingId} ref={heading} tabIndex={-1} className="font-display text-[22px] font-bold leading-tight text-fg outline-none">
        {title}
      </h1>
      {description ? <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">{description}</p> : null}
      <div className="mt-5 space-y-4">{children}</div>
      {footer ? <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-4 text-[13px] text-fg-2">{footer}</div> : null}
    </Panel>
  );
}

/** A form card on the left and the Demo inbox on the right (stacked on small screens). */
export function AuthSplit({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[960px] items-start gap-4 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <div className="min-w-0">{children}</div>
      <DemoInbox />
    </div>
  );
}

/** Text link styled for the footer of a card. */
export const authLink =
  'rounded-md font-medium text-cyan underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-cyan/40';
