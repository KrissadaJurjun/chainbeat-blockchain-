import { useSyncExternalStore } from 'react';

/* One shared once-a-second ticker: every countdown on the page reads the same value, and it only runs while one is mounted. */
let tick = Math.floor(Date.now() / 1000);
let subscribers = 0;
let timer: number | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  subscribers += 1;
  if (subscribers === 1) {
    tick = Math.floor(Date.now() / 1000);
    timer = window.setInterval(() => {
      tick = Math.floor(Date.now() / 1000);
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    subscribers -= 1;
    if (subscribers === 0) window.clearInterval(timer);
  };
}

/** With nobody subscribed the cached value would be stale, so read the clock; while subscribed the ticker keeps it fresh. */
const getSnapshot = (): number => (subscribers === 0 ? Math.floor(Date.now() / 1000) : tick);

/** Whole seconds left until `until` (a timestamp in ms), updated every second; 0 once it has passed or when `until` is null. */
export function useCountdown(until: number | null): number {
  const nowSeconds = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return until === null ? 0 : Math.max(0, Math.ceil(until / 1000 - nowSeconds));
}

/** `4:07` style clock for a number of seconds. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
