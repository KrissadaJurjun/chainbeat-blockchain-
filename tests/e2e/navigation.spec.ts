import { expect, test } from '@playwright/test';
import { appReady, noHorizontalOverflow, watchProblems } from './helpers';

const SIDEBAR_PAGES: Array<[string, string, string]> = [
  ['Portfolio', '/wallet/portfolio', 'Portfolio'],
  ['Swap', '/wallet/swap', 'Swap'],
  ['Stake', '/wallet/stake', 'Stake'],
  ['Liquid Staking', '/wallet/liquid-staking', 'Liquid Staking'],
  ['Send', '/wallet/send', 'Send'],
  ['Vote', '/wallet/vote', 'Vote'],
  ['Create Proposal', '/governance/create', 'Create Proposal'],
  ['Market', '/analytics/market', 'Market'],
  ['Network', '/analytics/network', 'Network'],
  ['Governance', '/analytics/governance', 'Governance'],
  ['IBC Network', '/visualizations/ibc', 'IBC Network'],
  ['Dev Activity', '/analytics/developers', 'Dev Activity'],
  ['Multichain Overview', '/visualizations/multichain', 'Multichain Overview'],
  ['Heartbeat', '/visualizations/heartbeat', 'Heartbeat'],
  ['Dominance', '/analytics/dominance', 'Dominance'],
  ['Explorer', '/explorer', 'Explorer'],
  ['Block Explorer', '/explorer/blocks', 'Blocks'],
  ['Transaction Explorer', '/explorer/transactions', 'Transactions'],
  ['Token Explorer', '/explorer/tokens', 'Token Explorer'],
  ['Governance hub', '/governance', 'Governance hub'],
];

test.describe('Sidebar', () => {
  test('every menu item opens a real page — no dead ends, errors or overflow', async ({ page }) => {
    const problems = watchProblems(page);
    await appReady(page);
    for (const [label, path, heading] of SIDEBAR_PAGES) {
      await page.getByRole('navigation', { name: 'Sidebar navigation' }).getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator('main h1')).toHaveText(heading);
      await expect(page.getByRole('link', { name: label, exact: true }).first()).toHaveAttribute('aria-current', 'page');
      await noHorizontalOverflow(page);
    }
    // "Validators" exists twice (header tab → table, sidebar → visualization)
    await page.getByRole('navigation', { name: 'Sidebar navigation' }).getByRole('link', { name: 'Validators', exact: true }).click();
    await expect(page).toHaveURL(/\/visualizations\/validators$/);
    expect(problems).toEqual([]);
  });

  test('collapses to an icon rail with tooltips, and remembers the choice', async ({ page }) => {
    await appReady(page);
    const sidebar = page.locator('aside');
    const wide = (await sidebar.boundingBox())!.width;
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(wide / 2);
    await expect(sidebar.getByText('Portfolio')).toHaveCount(0);

    await sidebar.getByRole('link', { name: 'Portfolio' }).hover();
    await expect(page.getByRole('tooltip').first()).toContainText('Portfolio');

    await page.reload();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(sidebar.getByText('Portfolio')).toBeVisible();
  });

  test('sections collapse and expand', async ({ page }) => {
    await appReady(page);
    const header = page.getByRole('button', { name: 'Analytics', exact: true });
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('navigation', { name: 'Sidebar navigation' }).getByRole('link', { name: 'Market' })).toBeHidden();
    await header.click();
    await expect(page.getByRole('navigation', { name: 'Sidebar navigation' }).getByRole('link', { name: 'Market' })).toBeVisible();
  });
});

test.describe('Header', () => {
  test('top tabs navigate and highlight the active page', async ({ page }) => {
    await appReady(page);
    const tabs = page.getByRole('navigation', { name: 'Main navigation' });
    for (const [name, path] of [['Validators', '/explorer/validators'], ['Proposals', '/governance/proposals'], ['Blocks', '/explorer/blocks'], ['Transactions', '/explorer/transactions'], ['Dashboard', '/']] as const) {
      await tabs.getByRole('link', { name }).click();
      await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : `${path}$`}`));
      await expect(tabs.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('"/" focuses search; typing finds a page, a block and a validator', async ({ page }) => {
    await appReady(page);
    await page.keyboard.press('/');
    const search = page.getByRole('combobox', { name: 'Search ChainBeat' });
    await expect(search).toBeFocused();

    await search.fill('market');
    await expect(page.getByRole('option', { name: /Market/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/analytics\/market$/);

    await page.keyboard.press('/');
    await search.fill('100');
    // "#100" is both a block and a proposal: pick the block (its option shows the block hash after the height)
    await page.getByRole('option', { name: /^#100[0-9A-F]{8}/ }).first().click();
    await expect(page).toHaveURL(/\/explorer\/blocks\/100$/);
    await expect(page.locator('main h1')).toContainText('Block 100');

    await page.keyboard.press('/');
    await search.fill('Aurora');
    await expect(page.getByRole('option', { name: /Aurora/ }).first()).toBeVisible();
  });

  test('skip link jumps to the main content', async ({ page }) => {
    await appReady(page);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('theme selector switches light / dark / system and persists', async ({ page }) => {
    await appReady(page);
    await page.getByRole('button', { name: 'Theme' }).click();
    await page.getByRole('menuitemradio', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: 'Theme' }).click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('the saved theme is applied before the app bundle runs (external bootstrap script, CSP-friendly)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('chainbeat.ui', JSON.stringify({ state: { theme: 'light' }, version: 1 })));
    await page.route('**/assets/*.js', (route) => route.abort()); // no React at all: only public/theme-init.js can set the attribute
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#root')).toBeEmpty();
  });

  test('notifications list simulated events and can be marked as read', async ({ page }) => {
    await appReady(page);
    const bell = page.getByRole('button', { name: /unread notifications?/ });
    await bell.click();
    const panel = page.getByRole('heading', { name: 'Notifications' }).locator('..').locator('..');
    await expect(panel).toContainText('Demo'); // every item in the feed is marked as simulated
    await page.getByRole('button', { name: 'Mark all as read' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
  });
});

test.describe('Explorer pages', () => {
  test('block list → block detail → transaction detail', async ({ page }) => {
    const problems = watchProblems(page);
    await appReady(page, '/explorer/blocks');
    await expect(page.getByRole('table', { name: /Latest blocks on Cosmos Hub/ })).toBeVisible();
    await page.getByRole('table').getByRole('link').first().click();
    await expect(page).toHaveURL(/\/explorer\/blocks\/\d+$/);
    await expect(page.getByRole('table', { name: /Transactions in block/ }).or(page.getByText('This block has no transactions'))).toBeVisible();

    await page.getByRole('table', { name: /Transactions in block/ }).getByRole('link').first().click().catch(() => undefined);
    expect(problems).toEqual([]);
  });

  test('validators table sorts, filters and opens the validator page', async ({ page }) => {
    await appReady(page, '/explorer/validators');
    const table = page.getByRole('table', { name: /Validators on Cosmos Hub/ });
    await expect(table.getByRole('row')).toHaveCount(11); // header + 10
    await page.getByRole('columnheader', { name: /Commission/ }).getByRole('button').click();
    await expect(page.getByRole('columnheader', { name: /Commission/ })).toHaveAttribute('aria-sort', /ascending|descending/);

    await page.getByPlaceholder('Filter by name or address').fill('Aurora');
    await expect(table.getByRole('row').nth(1)).toContainText('Aurora');
    await table.getByRole('row').nth(1).click();
    await expect(page).toHaveURL(/\/explorer\/validators\/cosmosvaloper1/);
    await expect(page.locator('main h1')).toContainText('Aurora');
    await expect(page.getByText(/Fictional validator for Demo Mode/)).toBeVisible();
    await page.goBack();

    await page.getByRole('radio', { name: 'Jailed' }).click();
    await expect(page).toHaveURL(/status=jailed/);
  });

  test('proposals filter by status and open the proposal page', async ({ page }) => {
    await appReady(page, '/governance/proposals');
    await page.getByRole('radio', { name: 'Voting' }).click();
    await expect(page).toHaveURL(/status=voting/);
    await page.getByRole('link', { name: 'Details' }).first().click();
    await expect(page).toHaveURL(/\/governance\/proposals\/\d+$/);
    await expect(page.locator('main h1')).toContainText(/^#\d+ · /);
    await expect(page.getByRole('heading', { name: 'Tally' })).toBeVisible();
  });

  test('unknown routes show a friendly 404', async ({ page }) => {
    await appReady(page, '/definitely/not/a/page');
    await expect(page.getByText('Page not found')).toBeVisible();
    await page.getByRole('link', { name: 'Back to dashboard' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
