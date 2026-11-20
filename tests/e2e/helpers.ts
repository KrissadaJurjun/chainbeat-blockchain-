import { expect, type Page } from '@playwright/test';

/** Collect console errors / warnings, uncaught exceptions and failed requests for the lifetime of a page. */
export function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on('requestfailed', (r) => {
    // A navigation or reload cancels whatever the previous document still had in flight (for instance the
    // lazily fetched Greek subset of Inter that the "Σ" cumulative-power label needs). That is the browser
    // behaving correctly, not an application fault; genuine failures (refused, DNS, reset…) are still reported.
    if (r.failure()?.errorText === 'net::ERR_ABORTED') return;
    problems.push(`requestfailed: ${r.url()} (${r.failure()?.errorText ?? 'unknown'})`);
  });
  return problems;
}

/** Wait for the app shell to mount (the main landmark with a page heading). */
export async function appReady(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await expect(page.locator('main h1')).toBeAttached();
}

export async function noHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(scrollWidth, `page is wider than the viewport (${scrollWidth} > ${clientWidth})`).toBeLessThanOrEqual(clientWidth + 1);
}

/**
 * Metric cards whose figure is cut off with an ellipsis, or whose label needs more than its two allowed lines.
 * Empty means every on-chain metric is fully readable at the current viewport and language.
 */
export async function truncatedMetricCards(page: Page): Promise<string[]> {
  return page.locator('section[aria-labelledby="metrics-title"] button[aria-haspopup="dialog"]').evaluateAll((cards) =>
    cards
      .filter((card) => {
        const value = card.querySelector<HTMLElement>('[data-metric-value]');
        const label = card.querySelector<HTMLElement>('[data-metric-label]');
        return (value !== null && value.scrollWidth > value.clientWidth + 1) || (label !== null && label.scrollHeight > label.clientHeight + 1);
      })
      .map((card) => (card as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
  );
}

/** Connect the simulated Demo wallet through the real UI. */
export async function connectDemoWallet(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Connect wallet' }).first().click();
  await page.getByRole('button', { name: /Demo wallet/ }).first().click();
  await expect(page.getByRole('button', { name: 'Wallet account' })).toBeVisible();
}

export async function pickLanguage(page: Page, code: string): Promise<void> {
  await page.locator('header button[aria-label^="Language"], header button[aria-label^="ภาษา"], header button[aria-label^="اللغة"]').first().click();
  await page.locator(`button[lang="${code}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('lang', code);
}
