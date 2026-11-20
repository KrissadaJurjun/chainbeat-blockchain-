import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { appReady, noHorizontalOverflow, pickLanguage, watchProblems } from './helpers';

/**
 * The optional demo accounts: register / sign in / forgot username / forgot password, one-time codes delivered to the
 * on-page Demo inbox, and "Sign in with Google" (simulated, and the real button against a STUB of Google's script —
 * nothing here ever talks to Google or to a mail server).
 */

const PASSWORD = 'Correct-Horse-9';

async function register(page: Page, { username = 'alex', email = 'alex@example.com', password = PASSWORD } = {}): Promise<void> {
  await appReady(page, '/register');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Send verification code' }).click();
  const code = (await page.getByTestId('inbox-code').first().innerText()).trim();
  expect(code).toMatch(/^\d{6}$/);
  await page.getByLabel('Verification code').fill(code);
  await page.getByRole('button', { name: 'Verify and create account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Account created' })).toBeVisible();
}

async function signOut(page: Page): Promise<void> {
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function signIn(page: Page, identifier: string, password: string): Promise<void> {
  await appReady(page, '/login');
  await page.getByLabel('Username or email address').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test.describe('Register, sign in and sign out', () => {
  test('register with a code from the Demo inbox, stay signed in across a reload, sign out, sign in again', async ({ page }) => {
    const problems = watchProblems(page);
    await register(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.locator('main h1')).toHaveText('My account');
    await expect(page.getByText('alex@example.com')).toBeVisible();

    await page.reload();
    await expect(page.locator('main h1')).toHaveText('My account'); // the session is stored in this browser

    // the header avatar shows who is signed in
    await page.getByRole('button', { name: 'Account menu: alex' }).click();
    await expect(page.getByRole('menuitem', { name: 'My account' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    // signed out on a page that needs an account: the visitor is sent to sign in (and would come back here afterwards)
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Account menu: Guest' })).toBeVisible(); // a guest again

    await page.goto('/account'); // a guest is sent to sign in, and back afterwards
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
    await expect(page.getByText('Please sign in to continue.')).toBeVisible();
    await page.getByLabel('Username or email address').fill('ALEX');
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.locator('main h1')).toHaveText('My account');
    expect(problems).toEqual([]);
  });

  test('the stored record holds a salted hash, never the password or a code', async ({ page }) => {
    await register(page);
    const stored = await page.evaluate(() => window.localStorage.getItem('chainbeat.auth') ?? '');
    expect(stored).toContain('pbkdf2-sha512$210000$');
    expect(stored).not.toContain(PASSWORD);
    const keys = await page.evaluate(() => Object.keys(window.localStorage));
    expect(keys.filter((k) => /otp|code|inbox/i.test(k))).toEqual([]);
  });

  test('a wrong password gets one generic message, and five wrong tries lock the account for a minute', async ({ page }) => {
    await register(page);
    await signOut(page);
    await signIn(page, 'alex', 'Wrong-Password-1');
    await expect(page.getByRole('alert').filter({ hasText: 'Incorrect username, email address or password.' })).toBeVisible();
    await signIn(page, 'nobody', 'Wrong-Password-1'); // same message for an account that does not exist
    await expect(page.getByRole('alert').filter({ hasText: 'Incorrect username, email address or password.' })).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await page.getByLabel('Username or email address').fill('alex');
      await page.getByLabel('Password', { exact: true }).fill(`Wrong-Password-${i}`);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page.getByRole('alert').first()).toBeVisible();
    }
    await expect(page.getByRole('alert').filter({ hasText: /Too many failed attempts\. Try again in \d+ seconds?\./ })).toBeVisible();
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /Too many failed attempts/ })).toBeVisible(); // even the right one is refused while locked
    await expect(page).toHaveURL(/\/login$/);
  });

  test('registration refuses a taken username, a weak password and a wrong code', async ({ page }) => {
    await register(page);
    await signOut(page);
    await appReady(page, '/register');
    await page.getByLabel('Username', { exact: true }).fill('ALEX');
    await page.getByLabel('Email address').fill('other@example.com');
    await page.getByLabel('Password', { exact: true }).fill('password123');
    await page.getByLabel('Confirm password').fill('password123');
    await page.getByRole('button', { name: 'Send verification code' }).click();
    await expect(page.getByText('Choose a stronger password. See the checklist below.')).toBeVisible();
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Send verification code' }).click();
    await expect(page.getByText('That username is already taken.')).toBeVisible();

    await page.getByLabel('Username', { exact: true }).fill('second');
    await page.getByRole('button', { name: 'Send verification code' }).click();
    await expect(page.locator('main h1')).toHaveText('Verify your email address');
    const code = (await page.getByTestId('inbox-code').innerText()).trim();
    await page.getByLabel('Verification code').fill(code === '000000' ? '111111' : '000000');
    await page.getByRole('button', { name: 'Verify and create account' }).click();
    await expect(page.getByText('That code is not correct. Attempts remaining: 4.')).toBeVisible();
    await page.getByLabel('Verification code').fill(code);
    await page.getByRole('button', { name: 'Verify and create account' }).click();
    await expect(page.locator('main h1')).toHaveText('Account created');
  });
});

test.describe('One-time codes', () => {
  test('a code expires after five minutes and a new one can be requested once the 30-second wait is over', async ({ page }) => {
    await page.clock.install();
    await appReady(page, '/register');
    await page.getByLabel('Username', { exact: true }).fill('alex');
    await page.getByLabel('Email address').fill('alex@example.com');
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Send verification code' }).click();
    const first = (await page.getByTestId('inbox-code').innerText()).trim();

    const resend = page.getByRole('button', { name: /^You can ask for a new code in \d+ seconds?\.$/ });
    await expect(resend).toBeDisabled();
    await page.clock.fastForward('06:00');
    await expect(page.getByText('This code has expired. Send a new code.').first()).toBeVisible();

    await page.getByLabel('Verification code').fill(first);
    await page.getByRole('button', { name: 'Verify and create account' }).click();
    await expect(page.getByText('This code has expired. Send a new code.').first()).toBeVisible();

    await page.getByRole('button', { name: 'Send a new code' }).click();
    await expect(page.getByTestId('inbox-code')).toHaveCount(2); // the old message stays, the new one is on top
    const second = (await page.getByTestId('inbox-code').first().innerText()).trim();
    await page.getByLabel('Verification code').fill(second);
    await page.getByRole('button', { name: 'Verify and create account' }).click();
    await expect(page.locator('main h1')).toHaveText('Account created');
  });

  test('five wrong codes lock the code, even for the right one', async ({ page }) => {
    await appReady(page, '/forgot-password');
    await register(page);
    await signOut(page);
    await appReady(page, '/forgot-password');
    await page.getByLabel('Username or email address').fill('alex');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.locator('main h1')).toHaveText('Enter the code');
    const code = (await page.getByTestId('inbox-code').innerText()).trim();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 4; i >= 1; i--) {
      await page.getByLabel('Verification code').fill(wrong);
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText(`That code is not correct. Attempts remaining: ${i}.`)).toBeVisible();
    }
    await page.getByLabel('Verification code').fill(wrong);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Too many wrong codes. Send a new code to try again.')).toBeVisible();
    await page.getByLabel('Verification code').fill(code);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Too many wrong codes. Send a new code to try again.')).toBeVisible();
    await expect(page.locator('main h1')).toHaveText('Enter the code');
  });
});

test.describe('Forgot password and forgot username', () => {
  test('reset the password with a code, then sign in with the new one only', async ({ page }) => {
    const problems = watchProblems(page);
    await register(page);
    await signOut(page);

    await appReady(page, '/forgot-password');
    await page.getByLabel('Username or email address').fill('alex@example.com');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.locator('main h1')).toHaveText('Enter the code');
    await expect(page.getByText('Reset your ChainBeat password')).toBeVisible();
    const code = (await page.getByTestId('inbox-code').first().innerText()).trim();
    await page.getByLabel('Verification code').fill(code);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.locator('main h1')).toHaveText('Choose a new password');
    await page.getByLabel('New password', { exact: true }).fill('alex12345'); // contains the username
    await page.getByLabel('Confirm password').fill('alex12345');
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.getByText('Choose a stronger password. See the checklist below.')).toBeVisible();
    await page.getByLabel('New password', { exact: true }).fill('Brand-New-Pass-7');
    await page.getByLabel('Confirm password').fill('Brand-New-Pass-7');
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.locator('main h1')).toHaveText('Password updated');

    await signIn(page, 'alex', PASSWORD);
    await expect(page.getByRole('alert').filter({ hasText: 'Incorrect username, email address or password.' })).toBeVisible();
    await signIn(page, 'alex', 'Brand-New-Pass-7');
    await expect(page).toHaveURL(/\/account$/);
    expect(problems).toEqual([]);
  });

  test('an address nobody registered gets a notice, never a code, and the page looks the same', async ({ page }) => {
    await appReady(page, '/forgot-password');
    await page.getByLabel('Username or email address').fill('stranger@example.com');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.locator('main h1')).toHaveText('Enter the code');
    await expect(page.getByText('ChainBeat account request')).toBeVisible();
    await expect(page.getByTestId('inbox-code')).toHaveCount(0);
    await page.getByLabel('Verification code').fill('123456');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('That code is not correct. Attempts remaining: 4.')).toBeVisible();
  });

  test('forgot username shows the username only after the code from the inbox', async ({ page }) => {
    await register(page, { username: 'Alex.Doe', email: 'alex@example.com' });
    await signOut(page);
    await appReady(page, '/forgot-username');
    await page.getByLabel('Email address').fill('alex@example.com');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.locator('main h1')).toHaveText('Confirm it is you');
    await expect(page.getByTestId('recovered-username')).toHaveCount(0);
    const code = (await page.getByTestId('inbox-code').first().innerText()).trim();
    await page.getByLabel('Verification code').fill(code);
    await page.getByRole('button', { name: 'Show my username' }).click();
    await expect(page.locator('main h1')).toHaveText('Your username');
    await expect(page.getByTestId('recovered-username')).toHaveText('Alex.Doe');
    await page.getByRole('link', { name: 'Sign in with this username' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('Sign in with Google', () => {
  test('without a client ID the button is a labelled simulation and nothing leaves this origin', async ({ page }) => {
    const origins = new Set<string>();
    page.on('request', (r) => {
      if (/^https?:/.test(r.url())) origins.add(new URL(r.url()).origin);
    });
    await appReady(page, '/login');
    await page.getByRole('button', { name: 'Sign in with Google (demo)' }).click();
    const dialog = page.getByRole('dialog', { name: 'Simulated Google sign-in' });
    await expect(dialog).toContainText('nothing is sent to Google');
    await dialog.getByRole('button', { name: 'Continue as Demo Google user' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText('Google (simulated)')).toBeVisible();
    for (const path of ['/register', '/forgot-username', '/forgot-password']) await appReady(page, path);
    expect([...origins]).toEqual([new URL(page.url()).origin]);
  });

  /** A stand-in for Google's script: the same `google.accounts.id` shape, a button that returns a token for the configured client. */
  const FAKE_GIS = `
    (function () {
      var cfg;
      function b64(o) { return btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\\+/g, '-').replace(/\\//g, '_'); }
      window.google = { accounts: { id: {
        initialize: function (c) { cfg = c; },
        renderButton: function (el) {
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = 'Stub Google button';
          b.onclick = function () {
            var claims = { iss: 'https://accounts.google.com', aud: window.__AUD || cfg.client_id, sub: 'g-1', email: 'sam@gmail.com', email_verified: true, name: 'Sam Google', nonce: cfg.nonce, exp: Math.floor(Date.now() / 1000) + 3600 };
            cfg.callback({ credential: b64({ alg: 'RS256' }) + '.' + b64(claims) + '.sig' });
          };
          el.appendChild(b);
        }
      } } };
    })();`;
  const CLIENT_ID = '123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com';

  test('pasting a client ID loads Google’s script and its button signs in (against a stub of the script)', async ({ page }) => {
    let scriptRequests = 0;
    await page.route('https://accounts.google.com/gsi/client', (route) => {
      scriptRequests += 1;
      return route.fulfill({ contentType: 'text/javascript', body: FAKE_GIS });
    });
    await appReady(page, '/login');
    expect(scriptRequests).toBe(0); // not before a client ID exists
    await page.getByText('Set up real Google sign-in').click();
    await expect(page.getByText('Authorized JavaScript origins')).toContainText('localhost:4173');

    await page.getByLabel('Google client ID').fill('hello');
    await page.getByRole('button', { name: 'Save client ID' }).click();
    await expect(page.getByText(/That is not a Google client ID/)).toBeVisible();
    await page.getByLabel('Google client ID').fill('GOCSPX-abcdefghijklmnopqrstuvwx');
    await page.getByRole('button', { name: 'Save client ID' }).click();
    await expect(page.getByText(/That looks like a client secret/)).toBeVisible();
    expect(scriptRequests).toBe(0);

    await page.getByLabel('Google client ID').fill(CLIENT_ID);
    await page.getByRole('button', { name: 'Save client ID' }).click();
    await expect(page.getByRole('button', { name: 'Stub Google button' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Google (demo)' })).toHaveCount(0);
    expect(scriptRequests).toBe(1);

    await page.reload(); // the ID is remembered in this browser
    await page.getByRole('button', { name: 'Stub Google button' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.locator('main')).toContainText('sam@gmail.com');
    await expect(page.getByText('Google', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Account menu: sam' }).click(); // username comes from the email
    await expect(page.getByRole('menuitem', { name: 'My account' })).toBeVisible();
  });

  test('a token made for another client ID is refused', async ({ page }) => {
    await page.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
    await page.addInitScript(() => {
      (window as unknown as { __AUD: string }).__AUD = 'someone-else.apps.googleusercontent.com';
    });
    await page.addInitScript((id) => window.localStorage.setItem('chainbeat.auth', JSON.stringify({ state: { accounts: [], session: null, googleClientId: id, throttle: {} }, version: 1 })), CLIENT_ID);
    await appReady(page, '/login');
    await page.getByRole('button', { name: 'Stub Google button' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'was meant for a different app' })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('when Google’s script cannot be loaded the page says so and offers a retry', async ({ page }) => {
    await page.route('https://accounts.google.com/gsi/client', (route) => route.abort('failed'));
    await page.addInitScript((id) => window.localStorage.setItem('chainbeat.auth', JSON.stringify({ state: { accounts: [], session: null, googleClientId: id, throttle: {} }, version: 1 })), CLIENT_ID);
    await appReady(page, '/login');
    await expect(page.getByRole('alert').filter({ hasText: 'The Google button could not be loaded.' })).toBeVisible();
    await page.unroute('https://accounts.google.com/gsi/client');
    await page.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('button', { name: 'Stub Google button' })).toBeVisible();
  });
});

test.describe('Header and settings', () => {
  test('the account menu offers a guest the sign-in pages', async ({ page }) => {
    await appReady(page);
    await page.getByRole('button', { name: 'Account menu: Guest' }).click();
    await page.getByRole('menuitem', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator('main h1')).toHaveText('Create your account');
    await page.getByRole('link', { name: 'Back to the explorer' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('the command palette finds the sign-in pages', async ({ page }) => {
    await appReady(page);
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox').fill('sign in');
    await page.getByRole('option', { name: /Sign in/ }).first().click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('settings lists the storage key, and “Clear all” removes the accounts', async ({ page }) => {
    await register(page);
    await appReady(page, '/settings');
    await expect(page.getByRole('row', { name: /chainbeat\.auth/ })).toContainText('Demo accounts');
    await page.getByRole('button', { name: 'Clear all ChainBeat data in this browser' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Clear|Confirm|Delete/ }).last().click();
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('chainbeat.auth'))).toBeNull();
  });
});

/* ───────── layout in every language, accessibility ───────── */

const SHIPPED_LANGUAGES = readdirSync(join(process.cwd(), 'src', 'i18n', 'locales'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const RTL = new Set(['ar', 'he', 'fa', 'ur']);

test.describe('Every shipped language on the sign-in pages', () => {
  for (const code of SHIPPED_LANGUAGES) {
    test(`${code}: all four pages and the code step, no overflow at 320 and 1280 px`, async ({ page }) => {
      test.setTimeout(120_000);
      const problems = watchProblems(page);
      await page.addInitScript((c) => window.localStorage.setItem('chainbeat.lang', c), code);
      for (const [width, height] of [
        [320, 640],
        [1280, 800],
      ] as const) {
        await page.setViewportSize({ width, height });
        for (const route of ['/login', '/register', '/forgot-username', '/forgot-password']) {
          await appReady(page, route);
          await expect(page.locator('html')).toHaveAttribute('lang', code);
          await expect(page.locator('html')).toHaveAttribute('dir', RTL.has(code) ? 'rtl' : 'ltr');
          await noHorizontalOverflow(page);
        }
        // the second step shows the inbox with a message: fill the first step by id (labels are translated)
        await appReady(page, '/register');
        await page.locator('#register-username').fill('alex');
        await page.locator('#register-email').fill('alex@example.com');
        await page.locator('#register-password').fill(PASSWORD);
        await page.locator('#register-confirm').fill(PASSWORD);
        await page.locator('form:has(#register-username) button[type=submit]').click();
        await expect(page.getByTestId('inbox-code')).toBeVisible();
        await noHorizontalOverflow(page);
        await page.evaluate(() => window.localStorage.removeItem('chainbeat.auth'));
      }
      expect(problems).toEqual([]);
    });
  }

  test('English pages carry no untranslated key', async ({ page }) => {
    for (const route of ['/login', '/register', '/forgot-username', '/forgot-password']) {
      await appReady(page, route);
      expect(await page.locator('body').innerText()).not.toMatch(/\bauth\.[a-z]+\.[a-zA-Z]+/);
    }
  });

  test('Thai and Arabic render translated headings', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('chainbeat.lang', 'th'));
    await appReady(page, '/login');
    await expect(page.locator('main h1')).toHaveText('เข้าสู่ระบบ');
    await pickLanguage(page, 'ar');
    await expect(page.locator('main h1')).toHaveText('تسجيل الدخول');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});

async function audit(page: Page): Promise<void> {
  await page.waitForTimeout(600);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const blocking = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = blocking.map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 4).map((n) => `   ${n.target.join(' ')}  ${n.failureSummary?.split('\n')[1] ?? ''}`).join('\n')}`).join('\n');
  expect(blocking, report).toEqual([]);
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`axe — account pages, ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => window.localStorage.setItem('chainbeat.ui', JSON.stringify({ state: { theme: t }, version: 1 })), theme);
    });

    test('code step with a message in the inbox, the setup guide, the simulated Google dialog and the account page', async ({ page }) => {
      await appReady(page, '/login');
      await page.getByText('Set up real Google sign-in').click();
      await audit(page);
      await page.getByRole('button', { name: 'Sign in with Google (demo)' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await audit(page);
      await page.keyboard.press('Escape');

      await appReady(page, '/register');
      await page.getByLabel('Username', { exact: true }).fill('alex');
      await page.getByLabel('Email address').fill('alex@example.com');
      await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
      await audit(page); // with the strength meter and the checklist
      await page.getByLabel('Confirm password').fill(PASSWORD);
      await page.getByRole('button', { name: 'Send verification code' }).click();
      await expect(page.getByTestId('inbox-code')).toBeVisible();
      await audit(page);
      await page.getByLabel('Verification code').fill('12');
      await page.getByRole('button', { name: 'Verify and create account' }).click();
      await expect(page.getByText('Enter the 6-digit code.')).toBeVisible();
      await audit(page); // with an error shown

      const code = (await page.getByTestId('inbox-code').first().innerText()).trim();
      await page.getByLabel('Verification code').fill(code);
      await page.getByRole('button', { name: 'Verify and create account' }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.locator('main h1')).toHaveText('My account');
      await audit(page);
    });
  });
}
