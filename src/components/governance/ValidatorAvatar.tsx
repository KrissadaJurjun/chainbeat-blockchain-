import { hashString } from '@/lib/prng';
import { cn } from '@/lib/utils';

/** Initials tile with a gradient derived from the name — a stand-in for validator logos (no real brand art). */
export function ValidatorAvatar({ name, className }: { name: string; className?: string }) {
  const h = hashString(name) % 360;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn('grid size-9 shrink-0 place-items-center rounded-[10px] text-[12px] font-bold tracking-wide text-white shadow-inner', className)}
      style={{ background: `linear-gradient(140deg, hsl(${h} 70% 55%), hsl(${(h + 55) % 360} 70% 38%))` }}
    >
      {initials}
    </span>
  );
}
