import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests run against the PRODUCTION build served by `vite preview`.
 *
 * Browser selection (no download required if Chrome / Edge is installed):
 *   PW_CHANNEL=chrome npx playwright test        # use the installed Google Chrome
 *   PW_CHANNEL=msedge npx playwright test        # use the installed Microsoft Edge
 *   PW_EXECUTABLE_PATH="C:\path\to\chrome.exe" npx playwright test
 *   npx playwright install chromium && npx playwright test   # Playwright's own Chromium
 */
const PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-US',
    timezoneId: 'UTC',
    channel: process.env.PW_CHANNEL || undefined,
    launchOptions: process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : undefined,
  },
  projects: [{ name: 'chromium', use: { viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // A short simulated latency keeps the suite fast while still exercising loading states.
    env: { VITE_SIM_LATENCY_MS: '40' },
  },
});
