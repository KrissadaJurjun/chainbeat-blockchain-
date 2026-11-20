import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, RouterProvider, Routes, createMemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/app/router';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { DemoInbox } from '@/components/auth/DemoInbox';
import { UserMenu } from '@/components/layout/UserMenu';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { setLanguage } from '@/i18n';
import * as google from '@/services/auth/google';
import { DEMO_GOOGLE_PROFILE, useAuthStore } from '@/stores/authStore';
import { useOtpStore } from '@/stores/otpStore';
import { renderApp } from '@/test/utils';
import AccountPage from './MyAccountPage';
import ForgotPasswordPage from './ForgotPasswordPage';
import ForgotUsernamePage from './ForgotUsernamePage';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';

vi.mock('@/services/auth/google', async (importOriginal) => ({ ...(await importOriginal<typeof google>()), loadGoogleIdentity: vi.fn() }));

const PASSWORD = 'Correct-Horse-9';

function renderAuth(route: string) {
  return renderApp(
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-username" element={<ForgotUsernamePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>
      <Route path="/account" element={<AccountPage />} />
      <Route path="/" element={<p>home page</p>} />
      <Route path="*" element={<p>some other page</p>} />
    </Routes>,
    { route },
  );
}

const where = (): string => screen.getByTestId('location').textContent ?? '';
const code = (): string => screen.getByTestId('inbox-code').textContent ?? '';
const user = () => userEvent.setup();

async function createAccount(username = 'alex', email = 'alex@example.com', password = PASSWORD) {
  const account = await useAuthStore.getState().createAccount({ username, email, password });
  useAuthStore.getState().signOut();
  return account;
}

beforeEach(() => vi.mocked(google.loadGoogleIdentity).mockReset());

/** The real route table, in a memory router (the other helpers wrap their UI in a MemoryRouter, which cannot nest). */
function renderRoutes(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { router, ...view };
}

describe('routes', () => {
  it('serves the sign-in pages in their own layout and sends a guest from /account to sign in', async () => {
    const first = renderRoutes('/login');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sidebar navigation' })).not.toBeInTheDocument(); // no app shell
    first.unmount();

    const { router } = renderRoutes('/account');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?next=%2Faccount');
    expect(screen.getByText('Please sign in to continue.')).toBeInTheDocument();
  });

  it('serves the other three pages, and the explorer’s own account page is still where it was', async () => {
    for (const [path, title] of [
      ['/register', 'Create your account'],
      ['/forgot-username', 'Forgot your username?'],
      ['/forgot-password', 'Forgot your password?'],
    ] as const) {
      const { unmount } = renderRoutes(path);
      expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      unmount();
    }
    const { router } = renderRoutes('/explorer/accounts/cosmos165ucu4jnqv6afjyh4s98exttk5m6295g63l657');
    await waitFor(() => expect(router.state.location.pathname).toBe('/explorer/accounts/cosmos165ucu4jnqv6afjyh4s98exttk5m6295g63l657'));
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'My account' })).not.toBeInTheDocument();
  });
});

describe('Sign in page', () => {
  it('explains that accounts are local to the demo and links to the other pages', () => {
    renderAuth('/login');
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('no real email or SMS is sent');
    expect(screen.getByRole('link', { name: 'Forgot username?' })).toHaveAttribute('href', '/forgot-username');
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
  });

  it('asks for both fields before it tries anything', async () => {
    renderAuth('/login');
    await user().click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
  });

  it('signs in with a username and goes to the account page', async () => {
    await createAccount();
    renderAuth('/login');
    const u = user();
    await u.type(screen.getByLabelText('Username or email address'), 'ALEX');
    await u.type(screen.getByLabelText('Password'), PASSWORD);
    await u.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(where()).toBe('/account'));
    expect(useAuthStore.getState().session?.method).toBe('password');
  });

  it('signs in with the email address and keeps the visitor signed in for 30 days when asked', async () => {
    await createAccount();
    renderAuth('/login');
    const u = user();
    await u.type(screen.getByLabelText('Username or email address'), 'alex@example.com');
    await u.type(screen.getByLabelText('Password'), PASSWORD);
    await u.click(screen.getByRole('checkbox', { name: 'Keep me signed in on this device' }));
    await u.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(where()).toBe('/account'));
    const s = useAuthStore.getState().session!;
    expect(s.expiresAt - s.startedAt).toBe(30 * 24 * 3_600_000);
  });

  it('shows one message for a wrong password and stays on the page', async () => {
    await createAccount();
    renderAuth('/login');
    const u = user();
    await u.type(screen.getByLabelText('Username or email address'), 'alex');
    await u.type(screen.getByLabelText('Password'), 'Wrong-Password-1');
    await u.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username, email address or password.');
    expect(where()).toBe('/login');
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('locks after five failed attempts and says for how long', async () => {
    await createAccount();
    renderAuth('/login');
    const u = user();
    await u.type(screen.getByLabelText('Username or email address'), 'alex');
    for (let i = 0; i < 5; i++) {
      await u.clear(screen.getByLabelText('Password'));
      await u.type(screen.getByLabelText('Password'), `Wrong-Password-${i}`);
      await u.click(screen.getByRole('button', { name: 'Sign in' }));
      await screen.findByRole('alert');
    }
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many failed attempts. Try again in 60 seconds.'));
  });

  it('goes where ?next= says — but only inside the app', async () => {
    await createAccount();
    for (const [next, expected] of [
      ['/explorer/blocks', '/explorer/blocks'],
      ['//evil.example/phish', '/account'],
      ['https://evil.example', '/account'],
    ] as const) {
      useAuthStore.getState().signOut();
      const { unmount } = renderAuth(`/login?next=${encodeURIComponent(next)}`);
      const u = user();
      await u.type(screen.getByLabelText('Username or email address'), 'alex');
      await u.type(screen.getByLabelText('Password'), PASSWORD);
      await u.click(screen.getByRole('button', { name: 'Sign in' }));
      await waitFor(() => expect(where()).toBe(expected));
      unmount();
    }
  });

  it('sends someone who is already signed in straight on', async () => {
    await createAccount();
    await useAuthStore.getState().signIn({ identifier: 'alex', password: PASSWORD });
    renderAuth('/login');
    await waitFor(() => expect(where()).toBe('/account'));
  });

  it('shows and hides the password', async () => {
    renderAuth('/login');
    const field = screen.getByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    await user().click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('speaks Thai', async () => {
    renderAuth('/login');
    await act(() => setLanguage('th'));
    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ลืมรหัสผ่าน?' })).toBeInTheDocument();
  });
});

describe('Create account page', () => {
  async function fill(u: ReturnType<typeof user>, over: Partial<Record<'username' | 'email' | 'password' | 'confirm', string>> = {}) {
    await u.type(screen.getByLabelText('Username', { selector: 'input' }), over.username ?? 'alex');
    await u.type(screen.getByLabelText('Email address'), over.email ?? 'alex@example.com');
    await u.type(screen.getByLabelText('Password', { selector: 'input' }), over.password ?? PASSWORD);
    await u.type(screen.getByLabelText('Confirm password'), over.confirm ?? over.password ?? PASSWORD);
  }

  it('walks through details → code in the Demo inbox → account created → signed in', async () => {
    renderAuth('/register');
    const u = user();
    expect(screen.getByRole('heading', { name: 'Demo inbox' })).toBeInTheDocument();
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();

    await fill(u);
    await u.click(screen.getByRole('button', { name: 'Send verification code' }));

    // step 2: the "email" is in the inbox, the page asks for its code
    expect(await screen.findByRole('heading', { level: 1, name: 'Verify your email address' })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    expect(screen.getByText(/We sent a 6-digit code to alex@example.com/)).toBeInTheDocument();
    expect(code()).toMatch(/^\d{6}$/);
    const inbox = screen.getByRole('region', { name: 'Demo inbox' });
    expect(within(inbox).getByText('Your ChainBeat verification code')).toBeInTheDocument();
    expect(within(inbox).getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^You can ask for a new code in \d+ seconds?\.$/ })).toBeDisabled();

    await u.type(screen.getByLabelText('Verification code'), code());
    await u.click(screen.getByRole('button', { name: 'Verify and create account' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Account created' })).toBeInTheDocument();
    expect(screen.getByText('Welcome, alex. You are now signed in.')).toBeInTheDocument();
    expect(useAuthStore.getState().accounts).toHaveLength(1);
    expect(useAuthStore.getState().session?.accountId).toBe(useAuthStore.getState().accounts[0]!.id);

    await u.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(where()).toBe('/account'));
  });

  it('rejects a wrong code, says how many tries are left and clears the field', async () => {
    renderAuth('/register');
    const u = user();
    await fill(u);
    await u.click(screen.getByRole('button', { name: 'Send verification code' }));
    await screen.findByRole('heading', { level: 1, name: 'Verify your email address' });
    const wrong = code() === '000000' ? '111111' : '000000';

    await u.type(screen.getByLabelText('Verification code'), wrong);
    await u.click(screen.getByRole('button', { name: 'Verify and create account' }));
    expect(await screen.findByText('That code is not correct. Attempts remaining: 4.')).toBeInTheDocument();
    expect(screen.getByLabelText('Verification code')).toHaveValue('');
    expect(useAuthStore.getState().accounts).toHaveLength(0);

    // a pasted code with a space is fine
    await u.type(screen.getByLabelText('Verification code'), `${code().slice(0, 3)} ${code().slice(3)}`);
    expect(screen.getByLabelText('Verification code')).toHaveValue(code());
    await u.click(screen.getByRole('button', { name: 'Verify and create account' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Account created' })).toBeInTheDocument();
  });

  it('wants six digits before it asks the checker', async () => {
    renderAuth('/register');
    const u = user();
    await fill(u);
    await u.click(screen.getByRole('button', { name: 'Send verification code' }));
    await screen.findByRole('heading', { level: 1, name: 'Verify your email address' });
    await u.type(screen.getByLabelText('Verification code'), '12');
    await u.click(screen.getByRole('button', { name: 'Verify and create account' }));
    expect(await screen.findByText('Enter the 6-digit code.')).toBeInTheDocument();
  });

  it('goes back to the details with the typed values still there', async () => {
    renderAuth('/register');
    const u = user();
    await fill(u);
    await u.click(screen.getByRole('button', { name: 'Send verification code' }));
    await screen.findByRole('heading', { level: 1, name: 'Verify your email address' });
    await u.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Username', { selector: 'input' })).toHaveValue('alex');
    expect(screen.getByLabelText('Email address')).toHaveValue('alex@example.com');
  });

  it('shows the password checklist and refuses a weak or mismatched password', async () => {
    renderAuth('/register');
    const u = user();
    await u.type(screen.getByLabelText('Username', { selector: 'input' }), 'alex');
    await u.type(screen.getByLabelText('Email address'), 'alex@example.com');
    expect(screen.getByRole('img', { name: 'Password strength: Too short' })).toBeInTheDocument();

    await u.type(screen.getByLabelText('Password', { selector: 'input' }), 'alexander99');
    expect(screen.getByText('At least 8 characters').parentElement).toHaveTextContent('Done');
    expect(screen.getByText('No part of your username or email').parentElement).toHaveTextContent('Not yet');
    await u.type(screen.getByLabelText('Confirm password'), 'different-123');
    await u.click(screen.getByRole('button', { name: 'Send verification code' }));
    expect(await screen.findByText('Choose a stronger password. See the checklist below.')).toBeInTheDocument();
    expect(screen.getByText('The passwords do not match.')).toBeInTheDocument();
    expect(useOtpStore.getState().inbox).toHaveLength(0); // nothing was "sent"
  });

  it('says so when the username or the email is already taken, without sending a code', async () => {
    await createAccount();
    renderAuth('/register');
    const u = user();
    await fill(u, { username: 'Alex', email: 'new@example.com' });
    await u.click(screen.getByRole('button', { name: 'Send verification code' }));
    expect(await screen.findByText('That username is already taken.')).toBeInTheDocument();
    await u.clear(screen.getByLabelText('Username', { selector: 'input' }));
    await u.type(screen.getByLabelText('Username', { selector: 'input' }), 'someone');
    await u.clear(screen.getByLabelText('Email address'));
    await u.type(screen.getByLabelText('Email address'), 'ALEX@example.com');
    await u.click(screen.getByRole('button', { name: 'Send verification code' }));
    expect(await screen.findByText('An account with this email address already exists.')).toBeInTheDocument();
    expect(useOtpStore.getState().inbox).toHaveLength(0);
  });

  it('can copy the code and clear the inbox', async () => {
    renderAuth('/register');
    const u = user();
    await fill(u);
    await u.click(screen.getByRole('button', { name: 'Send verification code' }));
    await screen.findByTestId('inbox-code');
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Clear inbox' }));
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
  });
});

describe('Forgot password page', () => {
  it('resets the password: username → code → new password → sign in with it', async () => {
    await createAccount();
    renderAuth('/forgot-password');
    const u = user();
    await u.type(screen.getByLabelText('Username or email address'), 'alex');
    await u.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Enter the code' })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByText(/If an account matches, a 6-digit code was sent/)).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Demo inbox' })).getByText('Reset your ChainBeat password')).toBeInTheDocument();

    await u.type(screen.getByLabelText('Verification code'), code());
    await u.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Choose a new password' })).toBeInTheDocument();

    await u.type(screen.getByLabelText('New password'), 'Brand-New-Pass-7');
    await u.type(screen.getByLabelText('Confirm password'), 'Brand-New-Pass-7');
    await u.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Password updated' })).toBeInTheDocument();

    await expect(useAuthStore.getState().signIn({ identifier: 'alex', password: PASSWORD })).rejects.toMatchObject({ code: 'invalidCredentials' });
    await expect(useAuthStore.getState().signIn({ identifier: 'alex', password: 'Brand-New-Pass-7' })).resolves.toMatchObject({ username: 'alex' });
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('looks the same for an address nobody registered — the inbox gets a notice, never a code', async () => {
    renderAuth('/forgot-password');
    const u = user();
    await u.type(screen.getByLabelText('Username or email address'), 'stranger@example.com');
    await u.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Enter the code' })).toBeInTheDocument();
    const inbox = screen.getByRole('region', { name: 'Demo inbox' });
    expect(within(inbox).getByText('ChainBeat account request')).toBeInTheDocument();
    expect(within(inbox).queryByTestId('inbox-code')).not.toBeInTheDocument();

    await u.type(screen.getByLabelText('Verification code'), '123456');
    await u.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('That code is not correct. Attempts remaining: 4.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Enter the code' })).toBeInTheDocument();
  });

  it('sends nothing at all for a username nobody has, yet shows the same screen', async () => {
    renderAuth('/forgot-password');
    const u = user();
    await u.type(screen.getByLabelText('Username or email address'), 'nobody');
    await u.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Enter the code' })).toBeInTheDocument();
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
  });

  it('can ask for a new code only after the wait, and starts over from the first step', async () => {
    await createAccount();
    renderAuth('/forgot-password');
    const u = user();
    await u.type(screen.getByLabelText('Username or email address'), 'alex');
    await u.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('heading', { level: 1, name: 'Enter the code' });
    expect(screen.getByRole('button', { name: /^You can ask for a new code in/ })).toBeDisabled();
    await u.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Forgot your password?' })).toBeInTheDocument();
  });
});

describe('Forgot username page', () => {
  it('shows the username once the code from the inbox is entered', async () => {
    await createAccount('Alex.Doe');
    renderAuth('/forgot-username');
    const u = user();
    await u.type(screen.getByLabelText('Email address'), 'ALEX@example.com');
    await u.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Confirm it is you' })).toBeInTheDocument();
    expect(screen.queryByText('Alex.Doe')).not.toBeInTheDocument(); // not before the code

    await u.type(screen.getByLabelText('Verification code'), code());
    await u.click(screen.getByRole('button', { name: 'Show my username' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Your username' })).toBeInTheDocument();
    expect(screen.getByTestId('recovered-username')).toHaveTextContent('Alex.Doe');
    expect(screen.getByRole('link', { name: 'Sign in with this username' })).toHaveAttribute('href', '/login');
  });

  it('never reveals anything for an unknown address', async () => {
    renderAuth('/forgot-username');
    const u = user();
    await u.type(screen.getByLabelText('Email address'), 'stranger@example.com');
    await u.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('heading', { level: 1, name: 'Confirm it is you' });
    await u.type(screen.getByLabelText('Verification code'), '123456');
    await u.click(screen.getByRole('button', { name: 'Show my username' }));
    expect(await screen.findByText('That code is not correct. Attempts remaining: 4.')).toBeInTheDocument();
    expect(screen.queryByTestId('recovered-username')).not.toBeInTheDocument();
  });

  it('checks the email format first', async () => {
    renderAuth('/forgot-username');
    await user().type(screen.getByLabelText('Email address'), 'not-an-email');
    await user().click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
  });
});

describe('Sign in with Google', () => {
  it('without a client ID it is a clearly labelled simulation that never contacts Google', async () => {
    renderAuth('/login');
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Sign in with Google (demo)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Simulated Google sign-in' });
    expect(dialog).toHaveTextContent('nothing is sent to Google');
    expect(dialog).toHaveTextContent(DEMO_GOOGLE_PROFILE.email);
    await u.click(within(dialog).getByRole('button', { name: 'Continue as Demo Google user' }));
    await waitFor(() => expect(where()).toBe('/account'));
    expect(useAuthStore.getState().session?.method).toBe('google-demo');
    expect(google.loadGoogleIdentity).not.toHaveBeenCalled();
    expect(document.querySelector('script[src*="accounts.google.com"]')).toBeNull();
  });

  it('the register page offers the same simulation with its own wording', async () => {
    renderAuth('/register');
    expect(screen.getByRole('button', { name: 'Sign up with Google (demo)' })).toBeInTheDocument();
  });

  it('the setup guide checks the pasted client ID before it is saved', async () => {
    renderAuth('/login');
    const u = user();
    await u.click(screen.getByText('Set up real Google sign-in'));
    expect(screen.getByText(/Authorized JavaScript origins/)).toHaveTextContent(window.location.origin);
    const field = screen.getByLabelText('Google client ID');

    await u.type(field, 'hello');
    await u.click(screen.getByRole('button', { name: 'Save client ID' }));
    expect(await screen.findByText(/That is not a Google client ID/)).toBeInTheDocument();

    await u.clear(field);
    await u.type(field, 'GOCSPX-abcdefghijklmnopqrstuvwx');
    await u.click(screen.getByRole('button', { name: 'Save client ID' }));
    expect(await screen.findByText(/That looks like a client secret/)).toBeInTheDocument();
    expect(useAuthStore.getState().googleClientId).toBeNull();
  });

  const fakeGoogle = (clientId: string) => {
    let config: Parameters<google.GoogleAccountsId['initialize']>[0] | undefined;
    const api: google.GoogleAccountsId = {
      initialize: (c) => {
        config = c;
      },
      renderButton: (parent) => {
        const button = document.createElement('button');
        button.textContent = 'Stub Google button';
        button.onclick = () => config?.callback({ credential: stubToken() });
        parent.append(button);
      },
    };
    const stubToken = (over: Record<string, unknown> = {}): string => {
      const enc = (v: unknown) => btoa(JSON.stringify(v)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      const claims = { iss: 'https://accounts.google.com', aud: clientId, sub: 'g-777', email: 'sam@gmail.com', email_verified: true, name: 'Sam Google', nonce: google.pageNonce, exp: Date.now() / 1000 + 3600, ...over };
      return `${enc({ alg: 'RS256' })}.${enc(claims)}.sig`;
    };
    return { api, stubToken, getConfig: () => config };
  };

  it('with a client ID it shows Google’s button, and a valid token signs in as a Google account', async () => {
    const id = '111111111111-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.apps.googleusercontent.com';
    useAuthStore.getState().setGoogleClientId(id);
    const fake = fakeGoogle(id);
    vi.mocked(google.loadGoogleIdentity).mockResolvedValue(fake.api);
    renderAuth('/login');
    const button = await screen.findByRole('button', { name: 'Stub Google button' });
    expect(screen.queryByRole('button', { name: /\(demo\)/ })).not.toBeInTheDocument();
    expect(fake.getConfig()).toMatchObject({ client_id: id, nonce: google.pageNonce, auto_select: false });

    await user().click(button);
    await waitFor(() => expect(where()).toBe('/account'));
    expect(useAuthStore.getState().session?.method).toBe('google');
    expect(useAuthStore.getState().accounts[0]).toMatchObject({ email: 'sam@gmail.com', googleSub: 'g-777', passwordHash: null });
  });

  it('refuses a token that was meant for another app', async () => {
    const id = '222222222222-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.apps.googleusercontent.com';
    useAuthStore.getState().setGoogleClientId(id);
    const fake = fakeGoogle(id);
    vi.mocked(google.loadGoogleIdentity).mockResolvedValue({
      ...fake.api,
      renderButton: (parent) => {
        const button = document.createElement('button');
        button.textContent = 'Stub Google button';
        button.onclick = () => fake.getConfig()?.callback({ credential: fake.stubToken({ aud: 'someone-else.apps.googleusercontent.com' }) });
        parent.append(button);
      },
    });
    renderAuth('/login');
    await user().click(await screen.findByRole('button', { name: 'Stub Google button' }));
    expect(await screen.findByText('Google’s reply was meant for a different app. Check the client ID.'.replace('’', "'"))).toBeInTheDocument();
    expect(where()).toBe('/login');
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('says so, and offers a retry, when Google’s script cannot be loaded', async () => {
    const id = '333333333333-cccccccccccccccccccccccccccccccc.apps.googleusercontent.com';
    useAuthStore.getState().setGoogleClientId(id);
    const fake = fakeGoogle(id);
    vi.mocked(google.loadGoogleIdentity).mockRejectedValueOnce(new Error('network')).mockResolvedValue(fake.api);
    renderAuth('/login');
    expect(await screen.findByRole('alert')).toHaveTextContent('The Google button could not be loaded.');
    await user().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Stub Google button' })).toBeInTheDocument();
  });

  it('lets the visitor remove a saved client ID', async () => {
    const id = '444444444444-dddddddddddddddddddddddddddddddd.apps.googleusercontent.com';
    useAuthStore.getState().setGoogleClientId(id);
    vi.mocked(google.loadGoogleIdentity).mockResolvedValue(fakeGoogle(id).api);
    renderAuth('/login');
    await screen.findByRole('button', { name: 'Stub Google button' });
    await user().click(screen.getByText('Set up real Google sign-in'));
    expect(screen.getByLabelText('Google client ID')).toHaveValue(id);
    await user().click(screen.getByRole('button', { name: 'Remove client ID' }));
    expect(useAuthStore.getState().googleClientId).toBeNull();
    expect(await screen.findByRole('button', { name: 'Sign in with Google (demo)' })).toBeInTheDocument();
  });
});

describe('My account page', () => {
  it('shows the signed-in account and how it signed in', async () => {
    await createAccount('alex', 'alex@example.com');
    await useAuthStore.getState().signIn({ identifier: 'alex', password: PASSWORD });
    renderAuth('/account');
    expect(await screen.findByRole('heading', { level: 1, name: 'My account' })).toBeInTheDocument();
    const details = screen.getByText('Username').closest('dl')!;
    expect(details).toHaveTextContent('alex');
    expect(details).toHaveTextContent('alex@example.com');
    expect(details).toHaveTextContent('Username and password');
    expect(screen.getByText(/exists only in this browser/)).toBeInTheDocument();
  });

  it('signs out and returns to the start page', async () => {
    await createAccount();
    await useAuthStore.getState().signIn({ identifier: 'alex', password: PASSWORD });
    renderAuth('/account');
    await user().click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(where()).toBe('/'));
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().accounts).toHaveLength(1);
  });

  it('deletes the account after a confirmation', async () => {
    await createAccount();
    await useAuthStore.getState().signIn({ identifier: 'alex', password: PASSWORD });
    renderAuth('/account');
    const u = user();
    await u.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this demo account' });
    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(useAuthStore.getState().accounts).toHaveLength(1);
    await u.click(screen.getByRole('button', { name: 'Delete account' }));
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete account' }));
    await waitFor(() => expect(where()).toBe('/'));
    expect(useAuthStore.getState().accounts).toHaveLength(0);
  });

  it('labels a simulated Google sign-in as simulated', async () => {
    useAuthStore.getState().signInWithGoogle(DEMO_GOOGLE_PROFILE, 'google-demo');
    renderAuth('/account');
    expect(await screen.findByText('Google (simulated)')).toBeInTheDocument();
  });
});

describe('Account menu in the header', () => {
  it('offers sign in and create account to a guest', async () => {
    renderApp(<UserMenu />);
    await user().click(screen.getByRole('button', { name: 'Account menu: Guest' }));
    expect(await screen.findByRole('menuitem', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('shows the signed-in account, its account page and sign out', async () => {
    await createAccount();
    await useAuthStore.getState().signIn({ identifier: 'alex', password: PASSWORD });
    renderApp(<UserMenu />);
    await user().click(screen.getByRole('button', { name: 'Account menu: alex' }));
    expect(await screen.findByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'My account' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Sign in' })).not.toBeInTheDocument();
    await user().click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(useAuthStore.getState().session).toBeNull());
  });
});

describe('Demo inbox', () => {
  it('says what it is and announces new messages', async () => {
    renderApp(<DemoInbox />);
    expect(screen.getByText(/no mail server or SMS gateway/)).toBeInTheDocument();
    act(() => {
      useOtpStore.getState().request('register', 'a@example.com', 'code');
    });
    expect(await screen.findByText('New message in the Demo inbox.')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('inbox-code')).toHaveTextContent(/^\d{6}$/);
    expect(screen.getByText(/never ask for your code, a seed phrase or a private key/)).toBeInTheDocument();
    expect(screen.getByText('Valid for 5 minutes.')).toBeInTheDocument();
  });
});
