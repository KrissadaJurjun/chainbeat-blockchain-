import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/utils';
import MarketPage from './MarketPage';

describe('Market analytics', () => {
  afterEach(() => vi.restoreAllMocks());

  it('switches the chart between price, market cap and volume', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderApp(<MarketPage />);
    expect(await screen.findByRole('img', { name: 'ATOM price over 7D' })).toBeInTheDocument();
    const metric = screen.getByRole('radiogroup', { name: 'Metric' });
    await user.click(within(metric).getByRole('radio', { name: 'Volume' }));
    expect(await screen.findByRole('img', { name: 'Volume of ATOM over 7D' })).toBeInTheDocument();
    await user.click(within(metric).getByRole('radio', { name: 'Market cap' }));
    expect(await screen.findByRole('img', { name: 'Market cap of ATOM over 7D' })).toBeInTheDocument();
  });

  it('compares two assets on an indexed chart and hides the metric switch while doing so', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderApp(<MarketPage />);
    await screen.findByRole('img', { name: 'ATOM price over 7D' });
    await user.click(screen.getByRole('combobox', { name: /Compare with/ }));
    await user.click(await screen.findByRole('option', { name: 'OSMO' }));
    expect(await screen.findByRole('img', { name: 'ATOM compared with OSMO, indexed to 100 at the start of the 7D range' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Metric' })).not.toBeInTheDocument();
    expect(screen.getByText(/so both start at 100/)).toBeInTheDocument();
  });

  it("lists every asset's market-cap share as text, and the shares add up to 100%", async () => {
    renderApp(<MarketPage />);
    const bar = await screen.findByRole('img', { name: /^Market-cap shares: / });
    const list = bar.nextElementSibling as HTMLElement;
    await waitFor(() => expect(within(list).getAllByRole('listitem').length).toBeGreaterThanOrEqual(5));
    const shares = within(list)
      .getAllByRole('listitem')
      .map((li) => Number((li.textContent ?? '').match(/([\d.]+)%$/)?.[1]));
    expect(shares.every((n) => Number.isFinite(n))).toBe(true);
    expect(shares.reduce((a, b) => a + b, 0)).toBeGreaterThan(99.4);
    expect(shares.reduce((a, b) => a + b, 0)).toBeLessThan(100.6);
  });
});
