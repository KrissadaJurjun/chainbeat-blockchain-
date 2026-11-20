import { useMediaQuery } from './useMediaQuery';
import { useUiStore } from '@/stores/uiStore';

/** True when the OS asks for reduced motion OR the user switched "Reduce motion" on in Settings. */
export function useReducedMotion(): boolean {
  const os = useMediaQuery('(prefers-reduced-motion: reduce)');
  const pref = useUiStore((s) => s.motion);
  return os || pref === 'reduce';
}
