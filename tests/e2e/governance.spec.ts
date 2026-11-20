import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { appReady, noHorizontalOverflow, watchProblems } from './helpers';

/**
 * Governance as a visitor uses it, in a real browser against the production build: find proposals (number, title,
 * category, status), open one and come back to the same view, read its history, copy and share it, and create a
 * simulated proposal — with a category, a voting period, a saved draft and a review before anything is created.
 */

const LATEST = 830; // the newest simulated proposal on the default network (Cosmos Hub)

const cards = (page: Page) => page.locator('main ul > li').filter({ has: page.getByRole('link', { name: 'Details' }) });
const titles = (page: Page) => cards(page).locator('h2');
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search proposals by title or number' });

test.describe('Proposals list', () => {
  test('search finds proposals by number, title, category and status, and says so when nothing matches', async ({ page }) => {
    const problems = watchProblems(page);
    await appReady(page, '/governance/proposals');
    await expect(titles(page).first()).toBeVisible();
    const total = await titles(page).count();
    expect(total).toBeGreaterThan(8);

    // number: with or without "#", only proposals whose number starts with it
    await search(page).fill(String(LATEST));
    await expect(titles(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText(`#${LATEST}`);
    await search(page).fill(`#${LATEST - 1}`);
    await expect(titles(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText(`#${LATEST - 1}`);

    // title (ignoring case): the third proposal's own title finds it (the simulation reuses some titles, so there may be a twin)
    await search(page).fill('');
    await expect(titles(page)).toHaveCount(total);
    const third = ((await titles(page).nth(2).textContent()) ?? '').trim();
    await search(page).fill(third.toUpperCase());
    await expect(titles(page).filter({ hasText: third }).first()).toBeVisible();
    await expect.poll(() => titles(page).count()).toBeLessThan(total);

    // category: the label shown on the cards ("Software upgrade")
    await search(page).fill('Software upgrade');
    await expect(titles(page).first()).toBeVisible();
    expect(await titles(page).count()).toBeLessThan(total);
    await expect(cards(page).filter({ hasText: 'Software upgrade' }).first()).toBeVisible();

    // status: the word "passed" finds at least every proposal the Passed filter shows
    await search(page).fill('');
    await page.getByRole('radiogroup', { name: 'Proposal filter' }).getByRole('radio', { name: 'Passed' }).click();
    await expect(titles(page).first()).toBeVisible();
    const passed = await titles(page).count();
    await page.getByRole('radiogroup', { name: 'Proposal filter' }).getByRole('radio', { name: 'All' }).click();
    await search(page).fill('passed');
    await expect(titles(page).first()).toBeVisible();
    expect(await titles(page).count()).toBeGreaterThanOrEqual(passed);

    // nothing matches
    await search(page).fill('no such proposal anywhere');
    await expect(page.getByText('No proposals match this filter.')).toBeVisible();
    await expect(page.getByText('No live proposals')).toHaveCount(0); // that wording belongs to the Voting filter alone
    await expect(titles(page)).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('the filter and the search survive opening a proposal and coming back', async ({ page }) => {
    await appReady(page, '/governance/proposals');
    await page.getByRole('radiogroup', { name: 'Proposal filter' }).getByRole('radio', { name: 'Passed' }).click();
    await expect(page).toHaveURL(/\?status=passed$/);
    const number = ((await cards(page).first().getByText(/^#\d+$/).textContent()) ?? '').trim();
    await search(page).fill(number);
    await expect(page).toHaveURL(/status=passed&q=/);
    await expect(titles(page)).toHaveCount(1);

    await titles(page).first().getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/governance/proposals/${number.slice(1)}$`));
    await page.locator('main').getByRole('link', { name: 'Proposals' }).click();

    await expect(page).toHaveURL(/\/governance\/proposals\?status=passed&q=/);
    await expect(search(page)).toHaveValue(number);
    await expect(page.getByRole('radiogroup', { name: 'Proposal filter' }).getByRole('radio', { name: 'Passed' })).toBeChecked();
    await expect(titles(page)).toHaveCount(1);

    // a reload keeps the same view (it is all in the address)
    await page.reload();
    await expect(search(page)).toHaveValue(number);
    await expect(titles(page)).toHaveCount(1);
  });
});

test.describe('Proposal page', () => {
  test('shows who proposed it, when voting starts and ends, and the history of the proposal', async ({ page }) => {
    const problems = watchProblems(page);
    await appReady(page, `/governance/proposals/${LATEST}`);
    await expect(page.locator('main h1')).toContainText(`#${LATEST} ·`);
    for (const label of ['Proposer', 'Submitted', 'Voting starts', 'Voting ends', 'Deposit', 'Network', 'Voting period']) {
      await expect(page.locator('main dt', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
    }
    const history = page.getByRole('heading', { name: 'Proposal history' }).locator('..');
    await expect(history.getByRole('listitem')).toHaveCount(3); // submitted → voting starts → voting ends (still open, no result yet)
    await expect(history.getByRole('listitem').first()).toContainText('Submitted');
    await expect(history).not.toContainText('Result');
    expect(problems).toEqual([]);
  });

  test('a decided proposal adds its result to the history', async ({ page }) => {
    await appReady(page, '/governance/proposals?status=passed');
    const number = ((await cards(page).first().getByText(/^#\d+$/).textContent()) ?? '').trim().slice(1);
    await appReady(page, `/governance/proposals/${number}`);
    const history = page.getByRole('heading', { name: 'Proposal history' }).locator('..');
    await expect(history.getByRole('listitem')).toHaveCount(4);
    await expect(history.getByRole('listitem').last()).toContainText('Result');
    await expect(history.getByRole('listitem').last()).toContainText('Passed');
  });

  test('copies the proposal number', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await appReady(page, `/governance/proposals/${LATEST}`);
    await page.getByRole('button', { name: 'Copy proposal number' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(String(LATEST));
  });

  test('shares the page link: the browser\'s share sheet when there is one, a copy of the link when there is not', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    // without a share sheet
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
    await appReady(page, `/governance/proposals/${LATEST}`);
    await page.locator('main').getByRole('button', { name: 'Share' }).click();
    await expect(page.getByText('Link copied to clipboard.')).toBeVisible();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  });

  test('with a share sheet, the title and the address of the page are what gets shared', async ({ page }) => {
    await page.addInitScript(() => {
      const shared: unknown[] = [];
      (window as unknown as { __shared: unknown[] }).__shared = shared;
      Object.defineProperty(navigator, 'share', { value: (data: unknown) => (shared.push(data), Promise.resolve()), configurable: true });
    });
    await appReady(page, `/governance/proposals/${LATEST}`);
    await page.locator('main').getByRole('button', { name: 'Share' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length)).toBe(1);
    const [data] = (await page.evaluate(() => (window as unknown as { __shared: Array<{ title: string; url: string }> }).__shared)) as Array<{ title: string; url: string }>;
    expect(data?.url).toBe(page.url());
    expect(`${(await page.locator('main h1').textContent()) ?? ''}`).toContain(data?.title ?? '#');
    await expect(page.getByText('Link copied to clipboard.')).toHaveCount(0); // the share sheet is its own confirmation
  });
});

test.describe('Create proposal', () => {
  const type = (page: Page) => page.getByRole('combobox', { name: /^Proposal type/ });
  const period = (page: Page) => page.getByRole('combobox', { name: /^Voting period/ });
  const TITLE = 'Fund the validator transparency report';
  const BODY = 'A yearly report on validator uptime, commission changes and self-delegation, published for every delegator.';

  async function openForm(page: Page): Promise<void> {
    await appReady(page, '/governance/create');
    await page.getByRole('button', { name: 'Use the Demo wallet' }).click();
    await expect(page.getByRole('form', { name: 'Create Proposal' })).toBeVisible();
  }

  async function fill(page: Page): Promise<void> {
    await type(page).click();
    await page.getByRole('option', { name: 'Other' }).click();
    await period(page).click();
    await page.getByRole('option', { name: '3 days' }).click();
    await page.getByLabel('Title').fill(TITLE);
    await page.getByLabel('Description').fill(BODY);
  }

  test('offers every category (including Other) and a voting period, and previews the proposal as it is written', async ({ page }) => {
    await openForm(page);
    await type(page).click();
    await expect(page.getByRole('option')).toHaveText(['Text', 'Parameter change', 'Community spend', 'Software upgrade', 'IBC', 'Other']);
    await page.keyboard.press('Escape');
    await period(page).click();
    await expect(page.getByRole('option')).toHaveText(['3 days', '5 days', '7 days', '14 days']);
    await page.keyboard.press('Escape');

    await fill(page);
    const preview = page.getByRole('region', { name: 'Preview' });
    await expect(preview).toContainText(TITLE);
    await expect(preview).toContainText('Other');
    await expect(preview).toContainText(`#${LATEST + 1}`);
  });

  test('saves a draft in this browser, restores it after a reload and can discard it', async ({ page }) => {
    const problems = watchProblems(page);
    await openForm(page);
    await fill(page);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved in this browser.')).toBeVisible();

    await page.reload();
    const form = page.getByRole('form', { name: 'Create Proposal' });
    await expect(form.getByRole('status')).toHaveText(/Your saved draft was restored\./);
    await expect(page.getByLabel('Title')).toHaveValue(TITLE);
    await expect(page.getByLabel('Description')).toHaveValue(BODY);
    await expect(type(page)).toContainText('Other');
    await expect(period(page)).toContainText('3 days');

    await page.getByRole('button', { name: 'Discard draft' }).click();
    await expect(form.getByRole('status')).toHaveCount(0);
    await expect(page.getByLabel('Title')).toHaveValue('');
    await page.reload();
    await expect(page.getByRole('form', { name: 'Create Proposal' })).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue(''); // gone for good
    expect(problems).toEqual([]);
  });

  test('"Cancel" returns to the proposals without creating anything', async ({ page }) => {
    await openForm(page);
    await fill(page);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/governance\/proposals$/);
    await expect(page.locator('main h1')).toHaveText('Proposals');
    await expect(titles(page).filter({ hasText: TITLE })).toHaveCount(0);
  });

  test('reviews the proposal, then creates it with its category and voting period and finds it in the list', async ({ page }) => {
    const problems = watchProblems(page);
    await openForm(page);
    await fill(page);
    await page.getByRole('button', { name: 'Save draft' }).click(); // a draft that must not outlive the submission
    await page.getByRole('button', { name: 'Submit proposal (simulated)' }).click();

    const dialog = page.getByRole('dialog', { name: 'Submit this demo proposal?' });
    await expect(dialog).toContainText(TITLE);
    await expect(dialog.locator('div', { has: page.getByText('Proposal type', { exact: true }) }).first()).toContainText('Other');
    await expect(dialog.locator('div', { has: page.getByText('Voting period', { exact: true }) }).first()).toContainText('3 days');
    await dialog.getByRole('button', { name: 'Submit (simulated)' }).click();

    await expect(page).toHaveURL(new RegExp(`/governance/proposals/${LATEST + 1}$`));
    await expect(page.locator('main h1')).toContainText(`#${LATEST + 1} · ${TITLE}`);
    await expect(page.locator('main dt', { hasText: /^Voting period$/ }).locator('..')).toContainText('3 days');

    await page.goto('/governance/proposals');
    await expect(titles(page).first()).toContainText(TITLE); // newest first
    await expect(cards(page).first()).toContainText('Other');
    await expect(cards(page).first()).toContainText('Demo');
    await search(page).fill('transparency report');
    await expect(titles(page)).toHaveCount(1);

    // the draft was used up by the submission
    await page.goto('/governance/create');
    await expect(page.getByRole('form', { name: 'Create Proposal' })).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue('');
    await expect(page.getByRole('form', { name: 'Create Proposal' }).getByRole('status')).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});

/** The ten sizes of the brief. */
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

/** How many distinct columns (left edges) a set of elements is laid out in. */
async function columnsOf(locator: Locator): Promise<number> {
  return new Set(await locator.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)))).size;
}

test.describe('Governance pages at every size of the brief', () => {
  for (const [width, height] of SIZES) {
    test(`${width}×${height}: the proposal list, a proposal and the create form fit, with the right number of columns`, async ({ page }) => {
      const problems = watchProblems(page);
      await page.setViewportSize({ width, height });

      // the list: four stat cards across from 1280 px, two from 640 px, one below; proposal cards in two columns from 1024 px
      await appReady(page, '/governance/proposals');
      await expect(titles(page).first()).toBeVisible();
      await noHorizontalOverflow(page);
      await expect(page.locator('main').getByRole('link', { name: 'Create Proposal' })).toBeVisible();
      await expect(search(page)).toBeVisible();
      expect(await columnsOf(page.locator('main .metric-card')), 'stat cards').toBe(width >= 1280 ? 4 : width >= 640 ? 2 : 1);
      expect(await columnsOf(cards(page)), 'proposal cards').toBe(width >= 1024 ? 2 : 1);

      // a proposal: the tally and history sit beside the description from 1280 px, under it below
      await appReady(page, `/governance/proposals/${LATEST}`);
      await expect(page.getByRole('heading', { name: 'Proposal history' })).toBeVisible();
      await noHorizontalOverflow(page);
      const description = (await page.locator('#proposal-description').boundingBox())!;
      const tally = (await page.getByRole('heading', { name: 'Tally' }).boundingBox())!;
      if (width >= 1280) expect(tally.x, 'tally beside the description').toBeGreaterThan(description.x + description.width / 2);
      else expect(Math.abs(tally.x - description.x), 'tally under the description').toBeLessThan(40);

      // the create form, with the preview beside it from 1280 px
      await appReady(page, '/governance/create');
      await page.getByRole('button', { name: 'Use the Demo wallet' }).click();
      await expect(page.getByRole('form', { name: 'Create Proposal' })).toBeVisible();
      await noHorizontalOverflow(page);
      const form = (await page.getByRole('form', { name: 'Create Proposal' }).boundingBox())!;
      const preview = (await page.getByRole('region', { name: 'Preview' }).boundingBox())!;
      if (width >= 1280) expect(preview.x, 'preview beside the form').toBeGreaterThan(form.x + form.width / 2);
      else expect(Math.abs(preview.x - form.x), 'preview under the form').toBeLessThan(40);
      expect(problems).toEqual([]);
    });
  }
});

/** Every language that ships — a locale folder exists — so a new locale is covered automatically. */
const LANGUAGES = readdirSync(join(process.cwd(), 'src', 'i18n', 'locales'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const RTL = new Set(['ar', 'he', 'fa', 'ur']);

test.describe('Governance pages in every language', () => {
  for (const code of LANGUAGES) {
    test(`${code}: proposals, a proposal and the create form (with a restored draft) fit at 320 and 1765 px`, async ({ page }) => {
      test.setTimeout(120_000);
      const problems = watchProblems(page);
      // a saved draft, so the create form shows its restored-draft line and every button
      await openCreateWithDraft(page);
      await page.evaluate((c) => localStorage.setItem('chainbeat.lang', c), code);

      for (const [width, height] of [
        [320, 640],
        [1765, 900],
      ] as const) {
        await page.setViewportSize({ width, height });
        for (const route of ['/governance/proposals', `/governance/proposals/${LATEST}`, '/governance/create']) {
          await appReady(page, route);
          await expect(page.locator('html')).toHaveAttribute('lang', code);
          await expect(page.locator('html')).toHaveAttribute('dir', RTL.has(code) ? 'rtl' : 'ltr');
          await expect(page.locator('.skeleton')).toHaveCount(0);
          await noHorizontalOverflow(page);
        }
        // the create form's own controls are all on screen (nothing pushed out of its card)
        const form = page.getByRole('form').first();
        const box = (await form.boundingBox())!;
        for (const button of await form.getByRole('button').all()) {
          const b = await button.boundingBox();
          if (!b) continue; // hidden (a closed select's native twin)
          expect(b.x, `${code} at ${width}: a button starts inside the form`).toBeGreaterThanOrEqual(box.x - 1);
          expect(b.x + b.width, `${code} at ${width}: a button ends inside the form`).toBeLessThanOrEqual(box.x + box.width + 1);
        }
      }
      expect(problems).toEqual([]);
    });
  }
});

async function openCreateWithDraft(page: Page): Promise<void> {
  await appReady(page, '/governance/create');
  await page.getByRole('button', { name: 'Use the Demo wallet' }).click();
  await page.getByLabel('Title').fill('A saved draft for the layout check');
  await page.getByLabel('Description').fill('This draft is saved so the create form shows its restored-draft line in every language.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft saved in this browser.')).toBeVisible();
}
