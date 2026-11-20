import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import { useFormat } from '@/hooks/useFormat';
import { cn } from '@/lib/utils';
import type { ProposalStatus, Tally } from '@/types/domain';

const OPTIONS = [
  { key: 'yes', color: 'var(--c-green)' },
  { key: 'no', color: 'var(--c-red)' },
  { key: 'abstain', color: 'var(--c-fg-3)' },
  { key: 'veto', color: 'var(--c-amber)' },
] as const;

export const TALLY_COLORS: Record<keyof Tally, string> = { yes: 'var(--c-green)', no: 'var(--c-red)', abstain: 'var(--c-fg-3)', veto: 'var(--c-amber)' };

/** Stacked horizontal bar of Yes / No / Abstain / Veto with an accessible text equivalent. */
export function TallyBar({ tally, legend = true, className }: { tally: Tally; legend?: boolean; className?: string }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const text = OPTIONS.map((o) => `${t(`vote.options.${o.key}`)} ${fmt.percent(tally[o.key], 1)}`).join(', ');
  return (
    <div className={className}>
      <div role="img" aria-label={text} className="flex h-2 overflow-hidden rounded-full bg-line">
        {OPTIONS.map((o) => (
          <span key={o.key} style={{ width: `${tally[o.key] * 100}%`, background: o.color }} />
        ))}
      </div>
      {legend ? (
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-3 2xl:text-[12px]" aria-hidden>
          {OPTIONS.map((o) => (
            <li key={o.key} className="inline-flex items-center gap-1">
              <i className="size-1.5 rounded-full" style={{ background: o.color }} />
              <span className="tabular-nums text-fg-2">{fmt.percent(tally[o.key], 0)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const TONES: Record<ProposalStatus, 'blue' | 'yellow' | 'green' | 'red' | 'neutral'> = {
  voting: 'blue',
  deposit: 'yellow',
  passed: 'green',
  rejected: 'red',
  failed: 'neutral',
};

export function ProposalStatusBadge({ status, className }: { status: ProposalStatus; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge tone={TONES[status]} className={cn(className)}>
      {t(`proposals.status.${status}`)}
    </Badge>
  );
}
