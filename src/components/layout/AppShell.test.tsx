import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/utils';
import { RouteAnnouncer } from './AppShell';

function Harness() {
  return (
    <>
      <nav>
        <Link to="/b">Go to B</Link>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<h1>Alpha</h1>} />
          <Route path="/b" element={<h1>Beta</h1>} />
        </Routes>
      </main>
      <RouteAnnouncer />
    </>
  );
}

describe('RouteAnnouncer', () => {
  it('is silent on the first load and announces the new page heading after a client-side navigation', async () => {
    const user = userEvent.setup();
    renderApp(<Harness />);
    const region = screen.getAllByRole('status').find((el) => el.getAttribute('aria-live') === 'polite') as HTMLElement;
    expect(region).toHaveTextContent('');
    await user.click(screen.getByRole('link', { name: 'Go to B' }));
    await waitFor(() => expect(region).toHaveTextContent('Navigated to Beta'), { timeout: 2000 });
  });
});
