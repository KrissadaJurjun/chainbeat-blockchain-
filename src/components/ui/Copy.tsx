import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn, shortHash } from '@/lib/utils';
import { Tip } from './Tooltip';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ value, className, label }: { value: string; className?: string; label?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const text = label ?? t('common.copy');
  return (
    <Tip label={copied ? t('common.copied') : text}>
      <button
        type="button"
        aria-label={text}
        onClick={async () => {
          if (await copyText(value)) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }
        }}
        className={cn('grid size-6 place-items-center rounded-md text-fg-3 transition-colors hover:bg-hover hover:text-fg', className)}
      >
        {copied ? <Check className="size-3.5 text-green" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </button>
    </Tip>
  );
}

/** A hash / address: monospaced, always left-to-right (even in RTL languages), shortened with a copy button. */
export function Hash({ value, head = 8, tail = 6, full, className }: { value: string; head?: number; tail?: number; full?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1', className)}>
      <span className="ltr-isolate truncate font-mono text-[12px] text-fg-2" title={value}>
        {full ? value : shortHash(value, head, tail)}
      </span>
      <CopyButton value={value} />
    </span>
  );
}
