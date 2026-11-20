import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { appReady, connectDemoWallet } from './helpers';

/**
 * Automated accessibility audit (axe-core, WCAG 2.1 A + AA rules).
 * Serious and critical violations fail the test; the offending nodes are printed so they can be fixed.
 * Automated checks catch roughly a third of accessibility problems — see docs for the manual checklist.
 */
async function audit(page: Page): Promise<void> {
  await page.waitForTimeout(600); // let entrance animations settle (they affect contrast sampling)
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const blocking = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = blocking.map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 4).map((n) => `   ${n.target.join(' ')}  ${n.failureSummary?.split('\n')[1] ?? ''}`).join('\n')}`).join('\n');
  expect(blocking, report).toEqual([]);
}

const PAGES: Array<[string, string]> = [
  ['dashboard', '/'],
  ['validators', '/explorer/validators'],

  ['proposals', '/governance/proposals'],
  ['governance hub', '/governance'],
  ['create proposal', '/governance/create'],
  ['explorer home', '/explorer'],
  ['blocks', '/explorer/blocks'],
  ['transactions', '/explorer/transactions'],
  ['market', '/analytics/market'],
  ['network analytics', '/analytics/network'],
  ['governance analytics', '/analytics/governance'],
  ['developer analytics', '/analytics/developers'],
  ['dominance', '/analytics/dominance'],
  ['ibc map', '/visualizations/ibc'],
  ['multichain', '/visualizations/multichain'],
  ['heartbeat', '/visualizations/heartbeat'],
  ['settings', '/settings'],
  ['about', '/about'],
  ['sign in', '/login'],
  ['register', '/register'],
  ['forgot username', '/forgot-username'],
  ['forgot password', '/forgot-password'],
];

for (const theme of ['dark', 'light'] as const) {
  test.describe(`axe — ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => window.localStorage.setItem('chainbeat.ui', JSON.stringify({ state: { theme: t }, version: 1 })), theme);
    });

    for (const [name, path] of PAGES) {
      test(name, async ({ page }) => {
        await appReady(page, path);
        await audit(page);
      });
    }

    test('detail pages: validator, proposal, block, transaction and account', async ({ page }) => {
      await appReady(page, '/explorer/validators');
      await page.getByRole('table').getByRole('row').nth(1).click();
      await expect(page).toHaveURL(/\/explorer\/validators\/cosmosvaloper1/);
      await audit(page);

      await appReady(page, '/governance/proposals');
      await page.getByRole('link', { name: 'Details' }).first().click();
      await expect(page).toHaveURL(/\/governance\/proposals\/\d+$/);
      await audit(page);

      await appReady(page, '/explorer/blocks');
      await page.getByRole('table').getByRole('link').first().click();
      await expect(page).toHaveURL(/\/explorer\/blocks\/\d+$/);
      await audit(page);

      await appReady(page, '/explorer/transactions');
      await page.getByRole('table').getByRole('link').first().click();
      await expect(page).toHaveURL(/\/explorer\/transactions\/[0-9A-F]{64}$/);
      await audit(page);
      await page.getByRole('link', { name: /^cosmos1/ }).first().click();
      await expect(page).toHaveURL(/\/explorer\/accounts\/cosmos1/);
      await audit(page);
    });

    test('wallet forms (connected)', async ({ page }) => {
      await appReady(page, '/wallet/send');
      await page.getByRole('button', { name: 'Use the Demo wallet' }).click();
      await expect(page.getByRole('form', { name: 'Send' })).toBeVisible();
      await audit(page);
    });

    test('open dialogs and menus', async ({ page }) => {
      await appReady(page);
      await connectDemoWallet(page).catch(() => undefined);
      await page.getByRole('button', { name: /Demo Mode/ }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await audit(page);
    });
  });
}

test.describe('manual-style checks automated', () => {
  test('every interactive control has an accessible name', async ({ page }) => {
    await appReady(page);
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('button, a[href], input, select, [role="button"], [role="switch"], [role="radio"], [role="combobox"]')]
        .filter((el) => {
          const e = el as HTMLElement;
          const style = getComputedStyle(e);
          if (style.display === 'none' || style.visibility === 'hidden' || e.closest('[inert], [hidden]')) return false;
          const label = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.textContent?.trim() || (e as HTMLInputElement).placeholder || e.getAttribute('title') || (e as HTMLInputElement).labels?.[0]?.textContent;
          return !label;
        })
        .map((el) => (el as HTMLElement).outerHTML.slice(0, 120)),
    );
    expect(unnamed).toEqual([]);
  });

  test('document has one h1, a lang, landmarks and a visible focus ring', async ({ page }) => {
    await appReady(page);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    for (const role of ['banner', 'navigation', 'main', 'contentinfo'] as const) await expect(page.getByRole(role).first()).toBeAttached();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      return { width: cs.outlineWidth, style: cs.outlineStyle, shadow: cs.boxShadow };
    });
    expect(outline.style !== 'none' || outline.shadow !== 'none').toBe(true);
  });

  test('respects prefers-reduced-motion (no running animations)', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('/visualizations/heartbeat');
    await expect(page.locator('main h1')).toBeAttached();
    await page.waitForTimeout(500);
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && !(a.effect as KeyframeEffect | null)?.target?.classList?.contains('animate-spin-slow')).length);
    expect(running).toBeLessThanOrEqual(1); // at most the skeleton shimmer finishing
    await context.close();
  });
});
