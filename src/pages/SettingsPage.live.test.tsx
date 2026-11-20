import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as Env from '@/config/env';
import { renderApp } from '@/test/utils';
import SettingsPage from './SettingsPage';

vi.mock('@/config/env', async (original) => ({ ...(await original<typeof Env>()), LIVE_REST_URL: 'https://rest.example.test/' }));

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });
const latest = { block: { header: { chain_id: 'testhub-1', height: '4321', time: '2026-11-18T08:00:00Z' } } };

describe('Settings → Test connection (only when an endpoint is configured)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports what the endpoint answered and never switches the data source', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (String(input).includes('/blocks/latest') ? json(latest) : json({ default_node_info: { network: 'testhub-1' } }))));
    const user = userEvent.setup();
    renderApp(<SettingsPage />);
    expect(await screen.findByText('https://rest.example.test/')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText(/Connected to testhub-1: latest block 4,321/)).toBeInTheDocument();
    expect(screen.getByText('Simulated network · height', { exact: false })).toBeInTheDocument(); // still the simulator
  });

  it('shows a plain explanation when the endpoint answers with something that is not a Cosmos REST API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ hello: 'world' })));
    const user = userEvent.setup();
    renderApp(<SettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText(/not in the format of a Cosmos REST API, so nothing was used/)).toBeInTheDocument();
  });

  it('shows a failure message when the endpoint cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const user = userEvent.setup();
    renderApp(<SettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText(/could not be reached/)).toBeInTheDocument();
  });
});
