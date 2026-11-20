import { expect, test } from '@playwright/test';
import { appReady, noHorizontalOverflow, watchProblems } from './helpers';

test.describe('Explorer', () => {
  test('transactions: list → details, copy the hash, follow the block and the sender to their pages', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const problems = watchProblems(page);
    await appReady(page, '/explorer/transactions');
    await page.getByRole('table').getByRole('link').first().click();
    await expect(page).toHaveURL(/\/explorer\/transactions\/[0-9A-F]{64}$/);
    const hash = page.url().split('/').pop() as string;

    await page.locator('main').getByRole('button', { name: 'Copy', exact: true }).first().click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(hash);

    await page.locator('main a[href^="/explorer/blocks/"]').first().click();
    await expect(page).toHaveURL(/\/explorer\/blocks\/\d+$/);
    await page.goBack();
    await page.locator('main a[href^="/explorer/accounts/"]').first().click();
    await expect(page).toHaveURL(/\/explorer\/accounts\/cosmos1/);
    await expect(page.locator('main h1')).toHaveText('Account');
    expect(problems).toEqual([]);
  });

  test('the search box resolves a pasted transaction hash straight to its page', async ({ page }) => {
    await appReady(page, '/explorer/transactions');
    const hash = (await page.getByRole('table').getByRole('link').first().getAttribute('title')) as string;
    await page.goto('/');
    await page.keyboard.press('/');
    await page.getByRole('combobox', { name: 'Search ChainBeat' }).fill(hash);
    await page.getByRole('option').first().click();
    await expect(page).toHaveURL(new RegExp(`/explorer/transactions/${hash}$`));
    await expect(page.locator('main h1')).toContainText('Transaction');
  });

  test('an invalid search explains itself instead of failing silently', async ({ page }) => {
    await appReady(page);
    await page.keyboard.press('/');
    await page.getByRole('combobox', { name: 'Search ChainBeat' }).fill('cosmos1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
    await expect(page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: /checksum/ }).first()).toBeVisible();
  });
});

test.describe('Demo wallet ↔ explorer consistency', () => {
  test('a Demo wallet transfer appears in the transaction list, its details page and the account page, clearly marked', async ({ page }) => {
    await appReady(page, '/wallet/send');
    await page.getByRole('button', { name: 'Use the Demo wallet' }).click();
    await page.getByRole('button', { name: 'Use a sample address' }).click();
    await page.getByLabel('Amount').fill('7');
    await page.getByRole('button', { name: 'Review transaction' }).click();
    await page.getByRole('dialog', { name: 'Review transaction' }).getByRole('button', { name: 'Send (simulated)' }).click();
    await expect(page.getByText(/Sent 7 ATOM to cosmos1/)).toBeVisible();

    await page.goto('/explorer/transactions');
    await page.getByRole('button', { name: /^Demo wallet \(1\)$/ }).click();
    const hashLink = page.getByRole('table').getByRole('link').first();
    await expect(hashLink).toHaveAttribute('title', /^DE0DE0/);
    await hashLink.click();
    await expect(page.getByText(/created by the Demo wallet/)).toBeVisible();

    await page.locator('main a[href^="/explorer/accounts/"]').first().click();
    await expect(page.getByText(/This is your Demo wallet/)).toBeVisible();
  });
});

test.describe('Notifications', () => {
  test('wallet and transaction events reach the bell; items can be dismissed and cleared', async ({ page }) => {
    await appReady(page, '/wallet/send');
    await page.getByRole('button', { name: 'Use the Demo wallet' }).click();
    await page.getByRole('button', { name: 'Use a sample address' }).click();
    await page.getByLabel('Amount').fill('1');
    await page.getByRole('button', { name: 'Review transaction' }).click();
    await page.getByRole('dialog', { name: 'Review transaction' }).getByRole('button', { name: 'Send (simulated)' }).click();

    await page.getByRole('button', { name: /unread notifications?/ }).click();
    const list = page.getByRole('list', { name: 'Notifications' });
    await expect(list).toContainText('Demo wallet connected (simulated).');
    await expect(list).toContainText(/Simulated transaction confirmed: Sent 1 ATOM to cosmos1/);
    await expect(page.getByText(/Nothing here is a live blockchain alert/)).toBeVisible();

    await list.getByRole('button', { name: 'Dismiss notification' }).first().click();
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByText("You're all caught up.")).toBeVisible();
  });

  test('"Simulate network errors" makes a confirmation fail visibly and changes nothing', async ({ page }) => {
    await appReady(page, '/wallet/send');
    await page.getByRole('button', { name: 'Use the Demo wallet' }).click();
    await page.getByRole('button', { name: /Demo Mode/ }).click();
    await page.getByRole('switch', { name: /Simulate network errors/ }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Use a sample address' }).click();
    await page.getByLabel('Amount').fill('5');
    await page.getByRole('button', { name: 'Review transaction' }).click();
    await page.getByRole('dialog', { name: 'Review transaction' }).getByRole('button', { name: 'Send (simulated)' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Simulated transaction failed' })).toBeVisible();
    await expect(page.getByText(/Sent 5 ATOM/)).toHaveCount(0);
  });
});

test.describe('Settings', () => {
  test('appearance, density and refresh preferences persist across a reload', async ({ page }) => {
    await appReady(page, '/settings');
    await page.getByRole('radio', { name: /Light/ }).click();
    await page.getByRole('switch', { name: /Compact layout/ }).click();
    await page.getByRole('switch', { name: /Reduce motion/ }).click();
    await page.getByRole('radiogroup', { name: 'Refresh live data' }).getByRole('radio', { name: 'Manual' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    await expect(page.getByRole('switch', { name: /Reduce motion/ })).toBeChecked();
    await expect(page.getByRole('radiogroup', { name: 'Refresh live data' }).getByRole('radio', { name: 'Manual' })).toBeChecked();
  });

  test('switching the network in Settings switches the data everywhere, and the data source stays "simulated"', async ({ page }) => {
    await appReady(page, '/settings');
    await page.getByRole('combobox', { name: /^Network/ }).click();
    await page.getByRole('option', { name: 'Osmosis' }).click();
    await expect(page.getByText('None (simulated data)')).toBeVisible();
    await page.getByRole('navigation', { name: 'Sidebar navigation' }).getByRole('link', { name: 'Network', exact: true }).click();
    await expect(page.getByText(/Health and performance of Osmosis/)).toBeVisible();
  });

  test('privacy section says what is stored and never asks for a seed phrase', async ({ page }) => {
    await appReady(page, '/settings');
    await expect(page.getByText(/never asks for, stores or sees a seed phrase/)).toBeVisible();
    await expect(page.getByText('chainbeat.wallet')).toBeVisible();
  });
});

test.describe('Governance', () => {
  test('create a demo proposal, find it in the list, open it and vote on it', async ({ page }) => {
    const problems = watchProblems(page);
    await appReady(page, '/governance/create');
    await page.getByRole('button', { name: 'Use the Demo wallet' }).click();
    await page.getByLabel('Title').fill('Fund the explorer accessibility review');
    await page.getByLabel('Description').fill('A review of keyboard, screen-reader and contrast behaviour across every page of the explorer.');
    await page.getByRole('button', { name: 'Submit proposal (simulated)' }).click();
    await page.getByRole('dialog', { name: 'Submit this demo proposal?' }).getByRole('button', { name: 'Submit (simulated)' }).click();

    await page.goto('/governance/proposals');
    const card = page.getByRole('link', { name: /Fund the explorer accessibility review/ }).first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/governance\/proposals\/\d+$/);
    await expect(page.locator('main h1')).toContainText('Fund the explorer accessibility review');
    await expect(page.getByText('Demo proposal (this browser only)').first()).toBeVisible();
    expect(problems).toEqual([]);
  });
});

test.describe('Analytics and visualisations', () => {
  test('IBC map: zoom in/out, reset, and a selected chain shows its details', async ({ page }) => {
    await appReady(page, '/visualizations/ibc');
    const controls = page.getByRole('group', { name: 'Zoom controls' });
    await controls.getByRole('button', { name: 'Zoom in' }).click();
    await expect(controls.getByLabel('Zoom level')).toHaveText('125%');
    await controls.getByRole('button', { name: 'Reset view' }).click();
    await expect(controls.getByLabel('Zoom level')).toHaveText('100%');
    await page.getByRole('group', { name: /IBC/ }).getByRole('button').first().click();
    await expect(page.getByText('Busiest partner')).toBeVisible();
  });

  test('market: switch the metric and compare two assets', async ({ page }) => {
    await appReady(page, '/analytics/market');
    await page.getByRole('radiogroup', { name: 'Metric' }).getByRole('radio', { name: 'Volume' }).click();
    await expect(page.getByRole('img', { name: 'Volume of ATOM over 7D' })).toBeVisible();
    await page.getByRole('combobox', { name: /Compare with/ }).click();
    await page.getByRole('option', { name: 'OSMO', exact: true }).click();
    await expect(page.getByRole('img', { name: /ATOM compared with OSMO/ })).toBeVisible();
  });

  test('dominance: the stacked view keeps the text alternative', async ({ page }) => {
    await appReady(page, '/analytics/dominance');
    await page.getByRole('radio', { name: 'Stacked' }).first().click();
    await expect(page.getByRole('list').filter({ hasText: 'Others' }).first()).toBeVisible();
  });

  test('every page says it is simulated (header chip) — including the new ones', async ({ page }) => {
    for (const route of ['/explorer', '/explorer/blocks', '/governance', '/analytics/market', '/analytics/network', '/visualizations/ibc', '/settings']) {
      await appReady(page, route);
      await expect(page.getByRole('button', { name: /Demo Mode/ })).toBeVisible();
    }
  });
});

test.describe('Languages', () => {
  test('the picker offers all 60 languages, searchable by native name, English name and code', async ({ page }) => {
    await appReady(page, '/settings');
    const section = page.locator('section[aria-labelledby="set-language"]');
    const list = section.locator('button[lang]');
    await expect(list).toHaveCount(60);
    await section.locator('input').first().fill('thai');
    await expect(list.filter({ hasText: 'ไทย' })).toBeVisible();
    await list.filter({ hasText: 'ไทย' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  });

  for (const [code, name] of [['he', 'Hebrew'], ['fa', 'Persian'], ['ur', 'Urdu']] as const) {
    test(`${name} (${code}): right-to-left, with hashes and addresses kept left-to-right`, async ({ page }) => {
      await page.addInitScript((c) => localStorage.setItem('chainbeat.lang', c), code);
      await appReady(page, '/explorer/transactions');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('html')).toHaveAttribute('lang', code);
      const direction = await page.getByRole('table').getByRole('link').first().evaluate((el) => getComputedStyle(el).direction);
      expect(direction).toBe('ltr');
      await noHorizontalOverflow(page);
    });
  }
});
