import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/storage';

const envLatency = Number(import.meta.env.VITE_SIM_LATENCY_MS ?? 280);
export const DEFAULT_LATENCY_MS = Number.isFinite(envLatency) ? Math.max(0, envLatency) : 280;

/** How fast the simulated clock runs: stopped, a fifth of real time, or real time. */
export type SimSpeed = 'paused' | 'slow' | 'normal';
export const SIM_SPEEDS: readonly SimSpeed[] = ['paused', 'slow', 'normal'];
export const SPEED_FACTOR: Record<SimSpeed, number> = { paused: 0, slow: 0.2, normal: 1 };

interface SimState {
  /** Simulated time (epoch ms) at the instant `anchorReal`; null while the clock simply follows real time. */
  anchorSim: number | null;
  anchorReal: number;
  speed: SimSpeed;
  /** Artificial network latency applied by the Demo provider. */
  latencyMs: number;
  /** When true every Demo provider call fails, so error states can be inspected. Never persisted. */
  forceError: boolean;
  /** Jump the simulated clock forward. */
  advance: (ms: number) => void;
  setSpeed: (speed: SimSpeed) => void;
  /** Back to real time at normal speed (latency and forced errors are reset too). */
  reset: () => void;
  setLatency: (ms: number) => void;
  setForceError: (value: boolean) => void;
}

const readClock = (s: Pick<SimState, 'anchorSim' | 'anchorReal' | 'speed'>): number =>
  s.anchorSim === null ? Date.now() : s.anchorSim + (Date.now() - s.anchorReal) * SPEED_FACTOR[s.speed];

export const useSimStore = create<SimState>()(
  persist(
    (set, get) => ({
      anchorSim: null,
      anchorReal: 0,
      speed: 'normal',
      latencyMs: DEFAULT_LATENCY_MS,
      forceError: false,
      advance: (ms) => set((s) => ({ anchorSim: readClock(s) + ms, anchorReal: Date.now() })),
      setSpeed: (speed) => {
        const s = get();
        // re-anchor at the current simulated instant so changing speed never jumps the clock
        set({ anchorSim: readClock(s), anchorReal: Date.now(), speed });
      },
      reset: () => set({ anchorSim: null, anchorReal: 0, speed: 'normal', latencyMs: DEFAULT_LATENCY_MS, forceError: false }),
      setLatency: (ms) => set({ latencyMs: Math.max(0, ms) }),
      setForceError: (value) => set({ forceError: value }),
    }),
    {
      name: 'chainbeat.sim',
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ anchorSim: s.anchorSim, anchorReal: s.anchorReal, speed: s.speed, latencyMs: s.latencyMs }),
      // version 1 stored a plain `offsetMs`; the simplest correct migration is to start from real time again
      migrate: (persisted, version) => (version < 2 ? { anchorSim: null, anchorReal: 0, speed: 'normal', latencyMs: DEFAULT_LATENCY_MS } : (persisted as Partial<SimState>)),
    },
  ),
);

/** The simulated current time (epoch ms). */
export const getSimNow = (): number => readClock(useSimStore.getState());

/** How far the simulated clock is ahead of the real one right now (ms; negative when it lags, e.g. while paused). */
export const getSimAheadMs = (): number => getSimNow() - Date.now();
