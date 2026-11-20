import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createColumnHelper } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';
import { OverviewChart } from '@/components/charts/OverviewChart';
import { DataTable } from '@/components/data/DataTable';
import { MetricsPanel } from '@/components/dashboard/MetricsPanel';
import { OverviewPanel } from '@/components/dashboard/OverviewPanel';
import { LanguageSelector } from '@/components/layout/LanguageSelector';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { DesktopSidebar } from '@/components/layout/Sidebar';
import { buildOverview } from '@/services/chain/demo/prices';
import { useChainStore } from '@/stores/chainStore';
import { useUiStore } from '@/stores/uiStore';
import { renderApp } from '@/test/utils';

const NOW = Date.UTC(2026, 10, 18, 9, 0, 0);

describe('Sidebar', () => {
  it('lists every required section and destination', () => {
    renderApp(<DesktopSidebar />);
    const nav = screen.getByRole('navigation', { name: 'Sidebar navigation' });
    for (const section of ['Explorer', 'Wallet', 'Analytics', 'Visualizations']) expect(within(nav).getByRole('button', { name: section })).toBeInTheDocument();
    for (const item of [
      'Portfolio', 'Swap', 'Stake', 'Liquid Staking', 'Send', 'Vote', 'Create Proposal', 'Market', 'Network', 'Governance',
      'IBC Network', 'Dev Activity', 'Multichain Overview', 'Heartbeat', 'Dominance', 'Validators', 'Block Explorer', 'Transaction Explorer', 'Token Explorer',
    ]) {
      expect(within(nav).getByRole('link', { name: item })).toHaveAttribute('href');
    }
  });

  it('switching network updates the selected network (and the pressed state)', async () => {
    const user = userEvent.setup();
    renderApp(<DesktopSidebar />);
    expect(screen.getByRole('button', { name: /^Cosmos Hub/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /^Osmosis/ }));
    expect(useChainStore.getState().chainId).toBe('osmosis');
    expect(screen.getByRole('button', { name: /^Osmosis/ })).toHaveAttribute('aria-pressed', 'true');
    useChainStore.getState().setChain('cosmoshub');
  });

  it('toggles favourites with an accessible label', async () => {
    const user = userEvent.setup();
    renderApp(<DesktopSidebar />);
    const star = screen.getByRole('button', { name: 'Remove Osmosis from favorites' });
    expect(star).toHaveAttribute('aria-pressed', 'true');
    await user.click(star);
    expect(useUiStore.getState().favorites).not.toContain('osmosis');
    expect(screen.getByRole('button', { name: 'Add Osmosis to favorites' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('collapses a section (aria-expanded + inert) and remembers it', async () => {
    const user = userEvent.setup();
    renderApp(<DesktopSidebar />);
    const header = screen.getByRole('button', { name: 'Wallet' });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('nav-section-wallet')).toHaveAttribute('inert');
    expect(useUiStore.getState().sectionsOpen.wallet).toBe(false);
  });

  it('icon-only mode hides labels but keeps accessible names', () => {
    useUiStore.setState({ sidebarCollapsed: true });
    renderApp(<DesktopSidebar />);
    expect(screen.queryByText('Portfolio')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Portfolio' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wallet' })).not.toBeInTheDocument(); // section headings collapse away
  });
});

describe('OverviewChart', () => {
  const data = buildOverview('24H', NOW);

  it('draws one line per visible series and honours the legend toggles', () => {
    const { container, rerender } = render(<OverviewChart data={data} hidden={new Set()} emphasisId="ATOM" />);
    expect([...container.querySelectorAll('path[data-series]')].map((p) => p.getAttribute('data-series'))).toEqual(['ATOM', 'OSMO', 'BTC']);
    rerender(<OverviewChart data={data} hidden={new Set(['OSMO'])} emphasisId="ATOM" />);
    expect([...container.querySelectorAll('path[data-series]')].map((p) => p.getAttribute('data-series'))).toEqual(['ATOM', 'BTC']);
  });

  it('labels the Y axis as an index and the X axis with unique time ticks', () => {
    render(<OverviewChart data={data} hidden={new Set()} emphasisId="ATOM" />);
    const svg = screen.getByRole('img', { name: /Performance index over 24H/ });
    const labels = [...svg.querySelectorAll('text')].map((t) => t.textContent ?? '');
    expect(labels.some((l) => /^\d+(\.\d)?$/.test(l))).toBe(true);
    const times = labels.filter((l) => /[AP]M$/.test(l));
    expect(times.length).toBeGreaterThan(2);
    expect(new Set(times).size).toBe(times.length);
  });

  it('shows a tooltip with index, USD price and change on pointer move, and hides it again', () => {
    const { container } = render(<OverviewChart data={data} hidden={new Set()} emphasisId="ATOM" />);
    expect(container.querySelector('.glass-pop')).toBeNull(); // idle: spotlight only
    fireEvent.pointerMove(screen.getByTestId('chart-surface'));
    const tip = container.querySelector('.glass-pop') as HTMLElement;
    expect(tip).not.toBeNull();
    expect(within(tip).getByText('ATOM')).toBeInTheDocument();
    expect(tip.textContent).toMatch(/\$[\d,.]+/);
    expect(tip.textContent).toMatch(/[+-]?\d+\.\d%/); // the very first point has exactly 0.0 % change
    fireEvent.pointerLeave(screen.getByTestId('chart-surface'));
    expect(container.querySelector('.glass-pop')).toBeNull();
  });

  it('is operable from the keyboard and announces the active point', async () => {
    const user = userEvent.setup();
    render(<OverviewChart data={data} hidden={new Set()} emphasisId="ATOM" />);
    const group = screen.getByRole('group', { name: /arrow keys/ });
    group.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    const live = group.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live.textContent).toMatch(/ATOM [\d.]+, OSMO [\d.]+, BTC [\d.]+/);
    await user.keyboard('{Escape}');
    expect(live.textContent).toBe('');
  });
});

describe('OverviewPanel', () => {
  it('switching the time range really changes the dataset, and switching back restores it', async () => {
    const user = userEvent.setup();
    renderApp(<OverviewPanel />);
    const line = async (): Promise<string> => {
      await waitFor(() => expect(document.querySelector('path[data-series="ATOM"]')).not.toBeNull());
      return document.querySelector('path[data-series="ATOM"]')?.getAttribute('d') ?? '';
    };
    const day = await line();
    await user.click(screen.getByRole('radio', { name: 'Last 7 days' }));
    await waitFor(async () => expect(await line()).not.toBe(day));
    const week = await line();
    expect(week.length).toBeGreaterThan(day.length * 1.3); // 169 vs 97 points
    await user.click(screen.getByRole('radio', { name: 'Last 24 hours' }));
    await waitFor(async () => expect(await line()).toBe(day));
  });

  it('series toggles never hide the last visible series', async () => {
    const user = userEvent.setup();
    renderApp(<OverviewPanel />);
    await screen.findByRole('button', { name: /ATOM/ });
    await user.click(screen.getByRole('button', { name: /OSMO/ }));
    await user.click(screen.getByRole('button', { name: /BTC/ }));
    expect([...document.querySelectorAll('path[data-series]')].map((p) => p.getAttribute('data-series'))).toEqual(['ATOM']);
    await user.click(screen.getByRole('button', { name: /ATOM/ }));
    expect(document.querySelectorAll('path[data-series]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /ATOM/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a retryable error state when the (simulated) network fails, then recovers', async () => {
    const { useSimStore } = await import('@/stores/simStore');
    useSimStore.setState({ forceError: true });
    const user = userEvent.setup();
    renderApp(<OverviewPanel />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load this data");
    useSimStore.setState({ forceError: false });
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(document.querySelector('path[data-series="ATOM"]')).not.toBeNull());
  });
});

describe('MetricsPanel', () => {
  it('renders the ten On-chain Metrics cards with their values', async () => {
    renderApp(<MetricsPanel />);
    await waitFor(() => expect(document.querySelectorAll('button[aria-haspopup="dialog"]')).toHaveLength(10));
    for (const label of ['Block Height', 'Transactions', 'Tx per Block', 'Block Time', 'Inflation', 'Staking APR', 'Bonded Tokens', 'Total Supply', 'Community Pool', 'Pool Value']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
    // the accessible name is the visible text (value, then label) plus the 24 h change — WCAG "Label in Name"
    // (\s* because jsdom has no CSS: the block-level spans only get a separating space in a real browser)
    expect(screen.getByRole('button', { name: /^\d+\.\d{2}%\s*Staking APR/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^\$[\d.]+M\s*Pool Value/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Block Height.*24 h change: \+[\d,]+ blocks/ })).toBeInTheDocument();
  });

  it('opens an explanation dialog with the formula for derived metrics', async () => {
    const user = userEvent.setup();
    renderApp(<MetricsPanel />);
    await user.click(await screen.findByRole('button', { name: /Staking APR/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Staking APR' });
    expect(dialog).toHaveTextContent('APR = inflation × (1 − community tax) ÷ bonded ratio');
    expect(dialog).toHaveTextContent('Simulated');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('the options menu exports the metrics as CSV', async () => {
    const csv = await import('@/lib/csv');
    const spy = vi.spyOn(csv, 'downloadText').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderApp(<MetricsPanel />);
    await screen.findByRole('button', { name: /Block Height/ });
    await user.click(screen.getByRole('button', { name: 'Options' }));
    await user.click(await screen.findByRole('menuitem', { name: /Export as CSV/ }));
    expect(spy).toHaveBeenCalledOnce();
    const [filename, text] = spy.mock.calls[0] as [string, string];
    expect(filename).toBe('chainbeat-metrics-cosmoshub.csv');
    expect(text.split('\r\n')).toHaveLength(11); // header + 10 metrics
    expect(text).toContain('Block Height');
  });
});

describe('GlobalSearch', () => {
  it('finds pages by name and navigates with the keyboard', async () => {
    const user = userEvent.setup();
    renderApp(<GlobalSearch />);
    const input = screen.getByRole('combobox', { name: 'Search ChainBeat' });
    await user.type(input, 'govern');
    const list = await screen.findByRole('listbox', { name: 'Search results' });
    const first = within(list).getAllByRole('option')[0] as HTMLElement;
    expect(first).toHaveTextContent('Governance');
    expect(first).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent('/analytics/governance');
  });

  it('resolves a block height to a block page', async () => {
    const user = userEvent.setup();
    renderApp(<GlobalSearch />);
    await user.type(screen.getByRole('combobox'), '100');
    expect(await screen.findByRole('option', { name: /#100.*Block/ })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent('/explorer/blocks/100');
  });

  it('offers both a block and a proposal for a number, in separate categories', async () => {
    const user = userEvent.setup();
    renderApp(<GlobalSearch />);
    await user.type(screen.getByRole('combobox'), '830');
    const list = await screen.findByRole('listbox', { name: 'Search results' });
    const options = within(list).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Block'), expect.stringContaining('Proposal')]));
  });

  it('explains an address whose checksum is wrong instead of searching', async () => {
    const user = userEvent.setup();
    renderApp(<GlobalSearch />);
    await user.type(screen.getByRole('combobox'), 'cosmos1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
    expect(await screen.findByText(/checksum does not match/)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('remembers what you opened and lists it as a recent search', async () => {
    const user = userEvent.setup();
    renderApp(<GlobalSearch />);
    const input = screen.getByRole('combobox');
    await user.type(input, '100');
    await screen.findByRole('option', { name: /#100.*Block/ });
    await user.keyboard('{Enter}');
    await user.click(input);
    const list = await screen.findByRole('listbox', { name: 'Recent searches' });
    expect(within(list).getByRole('option', { name: /#100/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear recent searches' }));
    expect(screen.queryByRole('listbox', { name: 'Recent searches' })).not.toBeInTheDocument();
  });

  it('says so when nothing matches and clears with Escape', async () => {
    const user = userEvent.setup();
    renderApp(<GlobalSearch />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'zzzzqq');
    expect(await screen.findByText(/No results for “zzzzqq”/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });
});

describe('LanguageSelector', () => {
  it('lists the shipped languages by their own name and switches the whole UI', async () => {
    const user = userEvent.setup();
    renderApp(<LanguageSelector />);
    await user.click(screen.getByRole('button', { name: /Language: English/ }));
    expect(screen.getByRole('button', { name: /ไทย/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /العربية/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ไทย/ }));
    await waitFor(() => expect(document.documentElement.lang).toBe('th'));
    expect(screen.getByRole('button', { name: /ภาษา: ไทย/ })).toBeInTheDocument();
  });
});

describe('DataTable', () => {
  interface Row {
    name: string;
    value: number;
  }
  const col = createColumnHelper<Row>();
  const columns = [col.accessor('name', { header: 'Name' }), col.accessor('value', { header: 'Value', meta: { align: 'end' } })];
  const rows: Row[] = Array.from({ length: 25 }, (_, i) => ({ name: `row-${String(i).padStart(2, '0')}`, value: (i * 7) % 25 }));
  const bodyNames = (): string[] => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0]?.textContent ?? '');

  it('sorts (aria-sort), paginates and reports the visible range', async () => {
    const user = userEvent.setup();
    renderApp(<DataTable data={rows} columns={columns} caption="Test rows" pageSize={10} />);
    expect(screen.getByRole('table', { name: 'Test rows' })).toBeInTheDocument();
    expect(screen.getByText('Showing 1–10 of 25')).toBeInTheDocument();
    expect(bodyNames()).toHaveLength(10);

    const valueHeader = screen.getByRole('columnheader', { name: /Value/ });
    expect(valueHeader).toHaveAttribute('aria-sort', 'none');
    await user.click(within(valueHeader).getByRole('button')); // TanStack sorts numeric columns descending-first
    expect(valueHeader).toHaveAttribute('aria-sort', 'descending');
    expect(within(screen.getAllByRole('row')[1] as HTMLElement).getAllByRole('cell')[1]).toHaveTextContent('24');
    await user.click(within(valueHeader).getByRole('button'));
    expect(valueHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(within(screen.getAllByRole('row')[1] as HTMLElement).getAllByRole('cell')[1]).toHaveTextContent('0');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Showing 11–20 of 25')).toBeInTheDocument();
  });

  it('shows an empty state, and a retryable error state', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<DataTable data={[]} columns={columns} caption="Empty" />);
    expect(screen.getByRole('status')).toHaveTextContent('No results match your filters.');
    rerender(<DataTable data={[]} columns={columns} caption="Err" error onRetry={onRetry} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
