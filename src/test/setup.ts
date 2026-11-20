import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { initI18n, setLanguage } from '@/i18n';
import { passwordConfig } from '@/services/auth/password';
import { useAuthStore } from '@/stores/authStore';
import { useOtpStore } from '@/stores/otpStore';
import { useSimStore } from '@/stores/simStore';
import { useUiStore } from '@/stores/uiStore';
import { useWalletStore } from '@/stores/walletStore';

/* ───────── jsdom gaps that Radix UI / charts rely on ───────── */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

window.matchMedia ??= ((query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList) as typeof window.matchMedia;

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => undefined;
Element.prototype.releasePointerCapture ??= () => undefined;
Element.prototype.scrollIntoView ??= () => undefined;
Element.prototype.scrollTo ??= () => undefined;
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

// Production hashes passwords with 210 000 PBKDF2 rounds (about a quarter of a second); the tests only need the logic.
passwordConfig.iterations = 1_000;

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  // deterministic, instant simulated network for every test
  useSimStore.setState({ anchorSim: null, anchorReal: 0, speed: 'normal', latencyMs: 0, forceError: false });
  await setLanguage('en');
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  useUiStore.setState({ sidebarCollapsed: false, sectionsOpen: {}, mobileNavOpen: false, dialog: null, theme: 'dark', motion: 'system' });
  useWalletStore.getState().disconnect();
  useWalletStore.getState().resetDemo();
  useAuthStore.setState({ accounts: [], session: null, googleClientId: null, throttle: {} });
  useOtpStore.getState().reset();
});
