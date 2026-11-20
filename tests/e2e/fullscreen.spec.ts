import { expect, test, type Page } from '@playwright/test';
import { appReady } from './helpers';

/**
 * The app is FULL-SCREEN: it fills the browser viewport with no outer margin, backdrop, rounded "window" or decorative
 * frame at any width. The header starts at the top-left corner, the sidebar (desktop) at the left edge under it, and the
 * content runs to the right and bottom edges. (Reference: reference/chainbeat-proposals.png.)
 */

const SIZES = [
  [1920, 1080],
  [1765, 900],
  [1440, 900],
  [1366, 768],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [375, 812],
  [320, 640],
] as const;

type Owner = 'header' | 'sidebar' | 'main' | 'footer' | 'backdrop' | 'content';

/** Which part of the app is painted at a point of the viewport ("backdrop" would mean an outer margin or frame). */
async function ownerAt(page: Page, x: number, y: number): Promise<Owner> {
  return page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px as number, py as number);
      if (!el) return 'backdrop';
      if (el.closest('header')) return 'header';
      if (el.closest('aside')) return 'sidebar';
      if (el.closest('main')) return 'main';
      if (el.closest('footer')) return 'footer';
      // the outermost wrappers, <body> and <html> are "backdrop": anything painted there is outside the app's own surfaces
      if (el === document.body || el === document.documentElement || el.id === 'root' || el.parentElement?.id === 'root') return 'backdrop';
      return 'content';
    },
    [x, y],
  );
}

for (const [width, height] of SIZES) {
  test(`${width}×${height}: header on the top edge, sidebar on the left edge, content to the right and bottom edges, no frame`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const route of ['/governance/proposals', '/']) {
      await appReady(page, route);
      await page.waitForTimeout(300);

      const header = (await page.locator('header').first().boundingBox())!;
      expect(header, `${route}: the header starts at the top-left corner`).toMatchObject({ x: 0, y: 0, height: 64 });
      expect(Math.round(header.width), `${route}: and spans the whole width`).toBe(width);

      const corners = await Promise.all([ownerAt(page, 2, 2), ownerAt(page, width - 3, 2), ownerAt(page, 2, height - 3), ownerAt(page, width - 3, height - 3)]);
      expect(corners[0], `${route}: top-left corner`).toBe('header');
      expect(corners[1], `${route}: top-right corner`).toBe('header');
      expect(corners[2] === 'backdrop', `${route}: bottom-left corner is part of the app (was ${corners[2]})`).toBe(false);
      expect(corners[3] === 'backdrop', `${route}: bottom-right corner is part of the app (was ${corners[3]})`).toBe(false);

      if (width >= 1024) {
        const sidebar = (await page.locator('aside').first().boundingBox())!;
        expect(sidebar, `${route}: the sidebar starts at the left edge, under the header`).toMatchObject({ x: 0, y: 64, width: 220 });
        expect(Math.round(sidebar.y + sidebar.height), `${route}: and runs to the bottom edge`).toBe(height);
        expect(corners[2], `${route}: bottom-left corner`).toBe('sidebar');
        const main = (await page.locator('main').boundingBox())!;
        expect(Math.round(main.x), `${route}: the content begins where the sidebar ends`).toBe(220);
        expect(main.x + main.width, `${route}: and runs to the right edge (less a classic scrollbar)`).toBeGreaterThanOrEqual(width - 20);
      } else {
        await expect(page.locator('aside')).toBeHidden(); // below 1024 px the sidebar is a drawer, not a column
      }

      const frame = await page.evaluate(() => {
        const outer = document.querySelector('#root > div');
        const style = outer ? getComputedStyle(outer) : null;
        return {
          classNames: document.querySelectorAll('.app-frame, .app-backdrop').length,
          padding: style?.padding,
          radius: style?.borderRadius,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(frame, `${route}: no outer padding, rounded corners, frame or horizontal scroll`).toEqual({ classNames: 0, padding: '0px', radius: '0px', overflow: 0 });
    }
  });
}

test('the light theme is full-screen too', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('chainbeat.ui', JSON.stringify({ state: { theme: 'light' }, version: 1 })));
  await page.setViewportSize({ width: 1765, height: 900 });
  await appReady(page, '/governance/proposals');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await Promise.all([ownerAt(page, 2, 2), ownerAt(page, 1762, 2), ownerAt(page, 2, 897)])).toEqual(['header', 'header', 'sidebar']);
});

test('collapsing the sidebar keeps it on the left edge and the content full width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await appReady(page, '/governance/proposals');
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect.poll(async () => Math.round((await page.locator('aside').first().boundingBox())!.width)).toBe(68);
  expect(await page.locator('aside').first().boundingBox()).toMatchObject({ x: 0, y: 64 });
  expect(Math.round((await page.locator('main').boundingBox())!.x)).toBe(68);
});

test('the Proposals page follows the reference: stat cards, filters, search and a two-column grid of cards', async ({ page }) => {
  await page.setViewportSize({ width: 1765, height: 900 });
  await appReady(page, '/governance/proposals');
  await expect(page.locator('main h1')).toHaveText('Proposals');
  await expect(page.getByText('Simulated', { exact: true }).first()).toBeVisible();
  await expect(page.locator('main').getByRole('link', { name: 'Create Proposal' })).toBeVisible();
  for (const label of ['Live', 'Total', 'Pass rate', 'Average turnout']) await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  const radios = page.getByRole('radiogroup', { name: 'Proposal filter' }).getByRole('radio');
  await expect(radios).toHaveText(['All', 'Voting', 'Deposit', 'Passed', 'Rejected', 'Failed']);
  await expect(page.getByPlaceholder('Search proposals by title or number')).toBeVisible();

  // two equal columns on desktop
  const cards = page.locator('main ul > li').filter({ has: page.getByRole('link', { name: 'Details' }) });
  const [first, second] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
  expect(Math.abs(first!.y - second!.y), 'the first two cards share a row').toBeLessThan(2);
  expect(Math.abs(first!.width - second!.width), 'in two equal columns').toBeLessThan(2);
  expect(second!.x, 'side by side').toBeGreaterThan(first!.x + first!.width);
});
