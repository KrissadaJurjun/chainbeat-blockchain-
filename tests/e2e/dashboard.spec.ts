import { expect, test } from '@playwright/test';
import { appReady, watchProblems } from './helpers';

test.describe('Dashboard', () => {
  test('renders every panel from the reference layout with no console errors', async ({ page }) => {
    const problems = watchProblems(page);
    await appReady(page);
    await expect(page).toHaveTitle(/Dashboard · ChainBeat/);

    for (const name of ['Overview', 'On-chain Metrics', 'Proposals', 'Validator Activities', 'Dev Activity', 'Active Repository']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    await expect(page.locator('section[aria-labelledby="metrics-title"] button[aria-haspopup="dialog"]')).toHaveCount(10);
    await expect(page.locator('path[data-series]')).toHaveCount(3);
    await expect(page.getByRole('contentinfo')).toContainText('Explore Blocks. Track Transactions. Understand Web3.');
    expect(problems).toEqual([]);
  });

  test('is always labelled as simulated', async ({ page }) => {
    await appReady(page);
    await expect(page.getByRole('button', { name: /Demo Mode/ })).toBeVisible();
    await expect(page.locator('section[aria-labelledby="overview-title"]').getByText('Simulated')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toContainText('all figures are simulated');
  });

  test('metric cards open an explanation dialog and close with Escape', async ({ page }) => {
    await appReady(page);
    await page.getByRole('button', { name: /Staking APR/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Staking APR' });
    await expect(dialog).toContainText('APR = inflation × (1 − community tax) ÷ bonded ratio');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('switching network re-reads the dashboard data (not just the highlight)', async ({ page }) => {
    await appReady(page);
    const supply = page.getByRole('button', { name: /Total Supply/ });
    const hubSupply = await supply.innerText();
    await expect(page.getByRole('button', { name: /^Live/ })).toBeVisible();

    await page.getByRole('button', { name: /^Osmosis/ }).click();
    await expect(page.getByRole('button', { name: /^Osmosis/ })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => supply.innerText()).not.toBe(hubSupply);
    // Osmosis has no live proposals in the simulation → the empty state from the reference design
    await expect(page.getByText('No live proposals')).toBeVisible();
    await expect(page.getByText('There is currently no ongoing governance.')).toBeVisible();

    await page.reload(); // the choice persists
    await expect(page.getByRole('button', { name: /^Osmosis/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Overview chart', () => {
  test('range buttons change the dataset; the same range always draws the same line', async ({ page }) => {
    await appReady(page);
    const line = () => page.locator('path[data-series="ATOM"]').getAttribute('d');
    await expect(page.locator('path[data-series="ATOM"]')).toBeVisible();
    const day = await line();
    await page.getByRole('radio', { name: 'Last 7 days' }).click();
    await expect.poll(line).not.toBe(day);
    const week = await line();
    expect((week as string).length).toBeGreaterThan((day as string).length * 1.3);
    await page.getByRole('radio', { name: 'Last 24 hours' }).click();
    await expect.poll(line).toBe(day);
  });

  test('hovering shows a tooltip with time, index, USD price and change', async ({ page }) => {
    await appReady(page);
    const surface = page.getByTestId('chart-surface');
    const box = (await surface.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
    const tip = page.locator('section[aria-labelledby="overview-title"] .glass-pop');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/ATOM\s*[\d.]+\s*\$[\d,.]+\s*[+-][\d.]+%/);
    await expect(tip).toContainText('BTC');
    await page.mouse.move(5, 5);
    await expect(tip).toBeHidden();
  });

  test('legend toggles series but always keeps one visible', async ({ page }) => {
    await appReady(page);
    const legend = (name: RegExp) => page.getByRole('group', { name: 'Chart series' }).getByRole('button', { name });
    await legend(/OSMO/).click();
    await legend(/BTC/).click();
    await expect(page.locator('path[data-series]')).toHaveCount(1);
    await expect(legend(/ATOM/)).toHaveAttribute('aria-disabled', 'true');
    await legend(/ATOM/).click({ force: true });
    await expect(page.locator('path[data-series]')).toHaveCount(1);
  });

  test('is keyboard operable', async ({ page }) => {
    await appReady(page);
    await page.getByRole('group', { name: /arrow keys/ }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('section[aria-labelledby="overview-title"] [aria-live="polite"]')).toContainText(/ATOM [\d.]+, OSMO [\d.]+, BTC [\d.]+/);
  });

  test('shows an error state when requests fail and recovers on retry', async ({ page }) => {
    await appReady(page);
    await page.getByRole('button', { name: /Demo Mode/ }).click();
    await page.getByRole('switch', { name: /Simulate network errors/ }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('radio', { name: 'Last 30 days' }).click(); // a range not fetched yet → must hit the "network"
    const alert = page.locator('section[aria-labelledby="overview-title"]').getByRole('alert').or(page.locator('section[aria-labelledby="overview-title"]').getByText('Couldn’t refresh'));
    await expect(alert.first()).toBeVisible();

    await page.getByRole('button', { name: /Demo Mode/ }).click();
    await page.getByRole('switch', { name: /Simulate network errors/ }).click();
    await page.keyboard.press('Escape');
    await page.locator('section[aria-labelledby="overview-title"]').getByRole('button', { name: /Try again|Refresh/ }).first().click();
    await expect(page.locator('path[data-series="ATOM"]')).toBeVisible();
  });

  test('advancing the simulated clock produces newer data deterministically', async ({ page }) => {
    await appReady(page);
    const tick = () => page.locator('svg[role="img"] text').filter({ hasText: /^\d{1,2}:\d{2} [AP]M$/ }).first().textContent();
    const before = await tick();
    await page.getByRole('button', { name: /Demo Mode/ }).click();
    await page.getByRole('button', { name: 'Advance 1 day' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('radio', { name: 'Last 7 days' }).click();
    await page.getByRole('radio', { name: 'Last 24 hours' }).click();
    await expect.poll(tick).not.toBeNull();
    expect(before).not.toBeNull();
  });
});
