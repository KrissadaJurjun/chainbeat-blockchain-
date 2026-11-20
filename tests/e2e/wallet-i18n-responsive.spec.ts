import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { appReady, connectDemoWallet, noHorizontalOverflow, pickLanguage, truncatedMetricCards, watchProblems } from './helpers';

test.describe('Demo wallet and simulated workflows', () => {
  test('connecting shows a clearly-marked demo identity and survives a reload', async ({ page }) => {
    await appReady(page);
    await connectDemoWallet(page);
    await expect(page.getByRole('status').filter({ hasText: 'Demo wallet connected (simulated).' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Wallet account' })).toBeVisible();
    await page.getByRole('button', { name: 'Wallet account' }).click();
    await expect(page.getByRole('menu')).toContainText('Demo wallet');
    await page.getByRole('menuitem', { name: 'Disconnect' }).click();
    await expect(page.getByRole('button', { name: 'Connect wallet' }).first()).toBeVisible();
  });

  test('without a wallet, wallet pages explain what to do instead of failing', async ({ page }) => {
    await appReady(page, '/wallet/send');
    await expect(page.getByText('Connect the Demo wallet to continue')).toBeVisible();
    await page.getByRole('button', { name: 'Use the Demo wallet' }).click();
    await expect(page.getByRole('form', { name: 'Send' })).toBeVisible();
  });

  test('send: validates the bech32 checksum, then updates only the demo ledger', async ({ page }) => {
    const problems = watchProblems(page);
    await appReady(page, '/wallet/send');
    await page.getByRole('button', { name: 'Use the Demo wallet' }).click();

    const recipient = page.getByLabel('Recipient address');
    await recipient.fill('cosmos1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
    await expect(page.getByText(/not a valid address/)).toBeVisible();
    await page.getByRole('button', { name: 'Use a sample address' }).click();
    await expect(page.getByText(/not a valid address|start with/)).toHaveCount(0);

    await page.getByLabel('Amount').fill('99999');
    await expect(page.getByText('Not enough ATOM in the Demo wallet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review transaction' })).toBeDisabled();

    await page.getByLabel('Amount').fill('25');
    await page.getByRole('button', { name: 'Review transaction' }).click();
    // review → cancel changes nothing; review → confirm does
    const review = page.getByRole('dialog', { name: 'Review transaction' });
    await expect(review).toContainText('No blockchain transfer occurs');
    await review.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(/Sent 25 ATOM to cosmos1/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Review transaction' }).click();
    await review.getByRole('button', { name: 'Send (simulated)' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sent (simulated)' })).toBeVisible();
    await expect(page.getByText(/Sent 25 ATOM to cosmos1/)).toBeVisible();

    await page.getByRole('link', { name: 'Portfolio', exact: true }).first().click();
    await expect(page.getByRole('row', { name: /ATOM/ })).toContainText('1,224.9975');
    expect(problems).toEqual([]);
  });

  test('swap quotes with fee and price impact, then moves balances', async ({ page }) => {
    await appReady(page, '/wallet/swap');
    await page.getByRole('button', { name: 'Use the Demo wallet' }).click();
    await page.getByLabel('You pay').fill('100');
    await expect(page.getByLabel('You receive')).not.toHaveValue('');
    await expect(page.getByText('0.30%')).toBeVisible();
    await page.getByRole('button', { name: 'Review swap' }).click();
    await page.getByRole('dialog', { name: 'Review swap' }).getByRole('button', { name: 'Confirm (simulated)' }).click();
    await expect(page.getByText(/Swapped 100 ATOM for [\d.,]+ OSMO/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Demo wallet balances' }).locator('..')).toContainText('1,150');
  });

  test('stake → portfolio shows the delegation; reset restores starting balances', async ({ page }) => {
    await appReady(page, '/wallet/stake');
    await page.getByRole('button', { name: 'Use the Demo wallet' }).click();
    await page.getByLabel('Amount').fill('200');
    await page.getByRole('button', { name: 'Review stake' }).click();
    await page.getByRole('dialog', { name: 'Review stake' }).getByRole('button', { name: 'Confirm (simulated)' }).click();
    await page.getByRole('link', { name: 'Portfolio', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Delegations' }).locator('../..')).toContainText('200 ATOM');

    await page.getByRole('button', { name: /Demo Mode/ }).click();
    await page.getByRole('button', { name: 'Reset demo wallet' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('No active delegations yet.')).toBeVisible();
  });

  test('vote and create-proposal work end to end', async ({ page }) => {
    await appReady(page, '/wallet/vote');
    await page.getByRole('button', { name: 'Use the Demo wallet' }).click();
    await page.getByRole('radiogroup', { name: 'Your vote' }).first().getByText('Yes', { exact: true }).click();
    await page.getByRole('button', { name: 'Review vote' }).first().click();
    await page.getByRole('dialog', { name: 'Review your vote' }).getByRole('button', { name: 'Confirm vote (simulated)' }).click();
    await expect(page.getByText('Your vote: Yes').first()).toBeVisible();

    await page.getByRole('navigation', { name: 'Sidebar navigation' }).getByRole('link', { name: 'Create Proposal' }).click();
    await page.getByLabel('Title').fill('Fund a public explorer security audit');
    await page.getByLabel('Description').fill('A longer description that explains why the community should fund an independent audit of the explorer.');
    await page.getByRole('button', { name: 'Submit proposal (simulated)' }).click();
    await page.getByRole('dialog', { name: 'Submit this demo proposal?' }).getByRole('button', { name: 'Submit (simulated)' }).click();
    await expect(page.getByText('Fund a public explorer security audit').last()).toBeVisible();
  });
});

test.describe('Internationalisation', () => {
  test('Thai: translated UI, Thai font loaded on demand, persists across reload', async ({ page }) => {
    const problems = watchProblems(page);
    await appReady(page);
    expect(await page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Noto Sans Thai') && f.status === 'loaded'))).toBe(false); // not shipped to English users
    await pickLanguage(page, 'th');
    await expect(page.locator('main h1')).toHaveText('แดชบอร์ด');
    await expect(page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('link', { name: 'วาลิเดเตอร์' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-script', 'thai');
    await expect.poll(() => page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Noto Sans Thai') && f.status === 'loaded'))).toBe(true);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'th');
    await page.goto('/explorer/validators');
    await expect(page.locator('main h1')).toHaveText('วาลิเดเตอร์');
    expect(problems).toEqual([]);
  });

  test('Arabic: right-to-left layout, Latin-digit numbers, correct plural form', async ({ page }) => {
    await appReady(page);
    await pickLanguage(page, 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('main h1')).toHaveText('لوحة التحكم');
    await expect(page.getByRole('button', { name: /إشعارات غير مقروءة/ })).toBeVisible();

    const [sidebar, main] = await Promise.all([page.locator('aside').boundingBox(), page.locator('main').boundingBox()]);
    expect(sidebar!.x, 'sidebar sits on the right in RTL').toBeGreaterThan(main!.x);
    // numbers stay readable: metric values use Latin digits
    await expect(page.locator('section[aria-labelledby="metrics-title"]')).toContainText(/\d{2},\d{3},\d{3}/);
    await noHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'فتح قائمة التنقل' }).click();
    const drawer = (await page.getByRole('dialog').boundingBox())!;
    expect(drawer.x, 'the drawer opens from the right edge in RTL').toBeGreaterThan(50);
  });

  test('switching back to English restores LTR and the language is searchable', async ({ page }) => {
    await appReady(page);
    await pickLanguage(page, 'ar');
    await pickLanguage(page, 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('main h1')).toHaveText('Dashboard');
  });
});

/** Every language that actually ships (a locale file exists) — read from disk so a new locale is covered automatically. */
const SHIPPED_LANGUAGES = readdirSync(join(process.cwd(), 'src', 'i18n', 'locales'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

test.describe('Every shipped language', () => {
  for (const code of SHIPPED_LANGUAGES) {
    test(`${code}: translated shell, correct direction, no overflow with a wallet connected (320 and 1280 px)`, async ({ page }) => {
      test.setTimeout(120_000); // 12 page loads per language
      const problems = watchProblems(page);
      await appReady(page);
      await connectDemoWallet(page); // done in English, then the language is switched via the same storage the picker writes
      await page.evaluate((c) => localStorage.setItem('chainbeat.lang', c), code);

      for (const [width, height] of [
        [320, 640],
        [1280, 800],
      ] as const) {
        await page.setViewportSize({ width, height });
        for (const route of ['/', '/explorer/validators', '/wallet/swap', '/governance/create', '/analytics/market', '/settings']) {
          await appReady(page, route);
          await expect(page.locator('html')).toHaveAttribute('lang', code);
          await expect(page.locator('html')).toHaveAttribute('dir', RTL_LANGUAGES.has(code) ? 'rtl' : 'ltr');
          await expect(page.locator('.skeleton')).toHaveCount(0); // measure the loaded layout, not the placeholders
          await noHorizontalOverflow(page);
        }
      }
      if (code !== 'en') {
        await expect(page.locator('main h1')).not.toHaveText('Network'); // the page heading really is translated
      }
      expect(problems).toEqual([]);
    });
  }
});

const VIEWPORTS = [
  ['1920×1080', 1920, 1080],
  ['1600×900', 1600, 900],
  ['1440×900', 1440, 900],
  ['1366×768', 1366, 768],
  ['1280×800', 1280, 800],
  ['1024×768', 1024, 768],
  ['768×1024', 768, 1024],
  ['430×932', 430, 932],
  ['390×844', 390, 844],
  ['375×812', 375, 812],
  ['320×640', 320, 640],
] as const;

test.describe('Responsive layout', () => {
  for (const [name, width, height] of VIEWPORTS) {
    test(`${name}: no horizontal scroll, header usable, panels visible`, async ({ page }) => {
      test.setTimeout(120_000); // nine routes per viewport, with the other workers busy
      await page.setViewportSize({ width, height });
      await appReady(page);
      await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
      for (const route of ['/', '/explorer/validators', '/explorer/transactions', '/governance', '/analytics/market', '/analytics/governance', '/analytics/dominance', '/visualizations/ibc', '/settings']) {
        await page.goto(route);
        await expect(page.locator('main h1')).toBeAttached();
        await expect(page.getByRole('banner')).toBeVisible();
        await noHorizontalOverflow(page);
      }
      // desktop shell has the permanent sidebar; below lg it becomes a drawer
      if (width >= 1024) {
        await expect(page.locator('aside')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeHidden();
      } else {
        await expect(page.locator('aside')).toBeHidden();
        await page.getByRole('button', { name: 'Open navigation menu' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeFocused(); // focus returns to the trigger
      }
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
      await page.screenshot({ path: `tests/e2e/__screenshots__/dashboard-${name}.png`, fullPage: false });
    });
  }

  // Localised figures and labels are often longer than English ("54,55 Mio. $", "US$5462.95万", "Gebundene Token"):
  // in every shipped language, at every common width, no metric may be cut off.
  for (const code of SHIPPED_LANGUAGES) {
    test(`${code}: every on-chain metric figure and label stays fully readable at all ${VIEWPORTS.length} common sizes`, async ({ page }) => {
      await page.addInitScript((c) => localStorage.setItem('chainbeat.lang', c), code);
      await appReady(page);
      await expect(page.locator('.skeleton')).toHaveCount(0);
      for (const [name, width, height] of VIEWPORTS) {
        await page.setViewportSize({ width, height });
        // two animation frames: lets the ResizeObserver-driven text fitting settle after the resize
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        expect(await truncatedMetricCards(page), `${code} at ${name}: metric cards with cut-off text`).toEqual([]);
      }
    });
  }
});
