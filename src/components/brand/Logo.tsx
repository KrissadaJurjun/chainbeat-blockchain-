import { useId } from 'react';
import { cn } from '@/lib/utils';

const HEX = '6.144,12 20,4 33.856,12 33.856,28 20,36 6.144,28';

/**
 * Original ChainBeat mark: a hexagon (a block) split into three linked arcs — purple, cyan, blue —
 * with a heartbeat pulse running through the middle.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true" focusable="false">
      <g strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polygon points={HEX} pathLength="96" stroke="var(--c-purple)" strokeDasharray="27 69" strokeDashoffset="-2.5" />
        <polygon points={HEX} pathLength="96" stroke="var(--c-cyan)" strokeDasharray="27 69" strokeDashoffset="-34.5" />
        <polygon points={HEX} pathLength="96" stroke="var(--c-blue)" strokeDasharray="27 69" strokeDashoffset="-66.5" />
      </g>
      <path d="M11.5 20.5H16L18.5 14L22 26L24.5 20.5H28.5" stroke="var(--c-fg)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display font-extrabold leading-none tracking-[0.03em] text-fg', className)} dir="ltr">
      CHAIN<span className="gradient-text">BEAT</span>
    </span>
  );
}

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="size-[34px] shrink-0" />
      {showWordmark ? <Wordmark className="text-[20px]" /> : null}
    </span>
  );
}

/** Small faceted gem used as a network icon (echoes the hexagon mark). */
export function ChainGem({ gradient, className }: { gradient: [string, string]; className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 16 16" className={cn('size-[18px] shrink-0', className)} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={gradient[0]} />
          <stop offset="1" stopColor={gradient[1]} />
        </linearGradient>
      </defs>
      <polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" fill={`url(#${id}-g)`} />
      <polygon points="8,1 14,4.5 8,8 2,4.5" fill="#fff" fillOpacity="0.28" />
      <polygon points="8,8 14,4.5 14,11.5 8,15" fill="#000" fillOpacity="0.18" />
    </svg>
  );
}
