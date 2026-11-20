import type { ComponentType } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bech32Encode } from '@/lib/bech32';
import { encodeRef } from '@/services/chain/demo/ids';
import { useChainStore } from '@/stores/chainStore';
import { useToastStore } from '@/stores/toastStore';
import { useWalletStore } from '@/stores/walletStore';
import { connectDemoWallet, renderApp } from '@/test/utils';

type Page = () => Promise<{ default: ComponentType }>;

const PAGES: Array<[string, Page, string]> = [
  ['Dashboard', () => import('./DashboardPage'), 'Dashboard'],
  ['Validators', () => import('./ValidatorsPage'), 'Validators'],
  ['Proposals', () => import('./ProposalsPage'), 'Proposals'],
  ['Blocks', () => import('./BlocksPage'), 'Blocks'],
  ['Transactions', () => import('./TransactionsPage'), 'Transactions'],
  ['Tokens', () => import('./TokensPage'), 'Token Explorer'],
  ['Portfolio', () => import('./PortfolioPage'), 'Portfolio'],
  ['Swap', () => import('./SwapPage'), 'Swap'],
  ['Stake', () => import('./StakePage'), 'Stake'],
  ['Liquid staking', () => import('./LiquidStakingPage'), 'Liquid Staking'],
  ['Send', () => import('./SendPage'), 'Send'],
  ['Vote', () => import('./VotePage'), 'Vote'],
  ['Create proposal', () => import('./CreateProposalPage'), 'Create Proposal'],
  ['Market', () => import('./MarketPage'), 'Market'],
  ['Network', () => import('./NetworkPage'), 'Network'],
  ['Governance', () => import('./GovernanceAnalyticsPage'), 'Governance'],
  ['IBC', () => import('./IbcPage'), 'IBC Network'],
  ['Dev activity', () => import('./DevActivityPage'), 'Dev Activity'],
  ['Multichain', () => import('./MultichainPage'), 'Multichain Overview'],
  ['Heartbeat', () => import('./HeartbeatPage'), 'Heartbeat'],
  ['Dominance', () => import('./DominancePage'), 'Dominance'],
  ['Validators viz', () => import('./ValidatorsVizPage'), 'Validators'],
  ['Not found', () => import('./NotFoundPage'), 'Page not found'],
];

describe('every page renders without runtime or React errors', () => {
  let errors: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined); // Recharts size warnings in jsdom
    await connectDemoWallet();
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(PAGES)('%s', async (_name, load, heading) => {
    const Page = (await load()).default;
    renderApp(<Page />);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    // let the first round of simulated data arrive, then make sure nothing blew up while rendering it
    await waitFor(() => expect(screen.queryByText("Couldn't load this data")).not.toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 30));
    expect(errors).not.toHaveBeenCalled();
  });

  it('detail routes resolve their parameters (block + transaction), and unknown ones say "not found"', async () => {
    const Block = (await import('./BlockDetailPage')).default;
    const Tx = (await import('./TransactionDetailPage')).default;
    const hub = (await import('@/services/chain/registry')).getChain('cosmoshub');
    const { heightAt } = await import('@/services/chain/demo/blocks');
    const tip = heightAt(hub, Date.now()) - 5;

    const view = renderApp(
      <Routes>
        <Route path="/blocks/:height" element={<Block />} />
        <Route path="/transactions/:hash" element={<Tx />} />
      </Routes>,
      { route: `/blocks/${tip}` },
    );
    expect(await screen.findByRole('heading', { level: 1, name: new RegExp(`Block ${tip.toLocaleString('en-US')}`) })).toBeInTheDocument();
    view.unmount();

    const missing = renderApp(
      <Routes>
        <Route path="/blocks/:height" element={<Block />} />
      </Routes>,
      { route: '/blocks/999999999999' },
    );
    expect(await screen.findByText('Block not found')).toBeInTheDocument();
    missing.unmount();

    renderApp(
      <Routes>
        <Route path="/transactions/:hash" element={<Tx />} />
      </Routes>,
      { route: `/transactions/${encodeRef('cosmoshub', 'tx', tip, 0)}` },
    );
    // either a real transaction (block has ≥1 tx) or a clean not-found — never a crash
    await waitFor(() => expect(screen.queryByText('Transaction not found') ?? screen.queryByText(/Gas wanted/)).not.toBeNull());
  });
});

describe('wallet workflows are gated on the Demo wallet and clearly simulated', () => {
  it('shows a connect prompt (not a broken form) when no wallet is connected', async () => {
    const Swap = (await import('./SwapPage')).default;
    renderApp(<Swap />);
    expect(await screen.findByText('Connect the Demo wallet to continue')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Swap' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Use the Demo wallet' }));
    expect(await screen.findByRole('form', { name: 'Swap' })).toBeInTheDocument();
  });

  it('a real extension wallet is told that Demo Mode never signs anything', async () => {
    const w = window as unknown as Record<string, unknown>;
    w.keplr = { enable: async () => undefined, getKey: async () => ({ name: 'x', bech32Address: bech32Encode('cosmos', new Uint8Array(20).fill(5)) }) };
    const hub = (await import('@/services/chain/registry')).getChain('cosmoshub');
    await useWalletStore.getState().connect('keplr', hub);
    const Send = (await import('./SendPage')).default;
    renderApp(<Send />);
    expect(await screen.findByText('A real wallet is connected')).toBeInTheDocument();
    expect(screen.getByText(/never signs or broadcasts transactions/)).toBeInTheDocument();
    delete w.keplr;
  });
});

describe('Send: address + amount validation, then a simulated send', () => {
  beforeEach(async () => {
    await connectDemoWallet();
  });

  it('rejects bad addresses with specific reasons and accepts a valid one', async () => {
    const user = userEvent.setup();
    const Send = (await import('./SendPage')).default;
    renderApp(<Send />);
    const recipient = await screen.findByLabelText('Recipient address');

    await user.type(recipient, 'cosmos1notarealaddress');
    expect(await screen.findByText(/not a valid address/)).toBeInTheDocument();

    await user.clear(recipient);
    await user.type(recipient, bech32Encode('osmo', new Uint8Array(20).fill(7)));
    expect(await screen.findByText(/start with “cosmos1”/)).toBeInTheDocument();

    await user.clear(recipient);
    await user.type(recipient, bech32Encode('cosmos', new Uint8Array(20).fill(7)));
    await waitFor(() => expect(screen.queryByText(/not a valid address|start with/)).not.toBeInTheDocument());
  });

  it('blocks overspending, then sends and updates only the Demo ledger', async () => {
    const user = userEvent.setup();
    const Send = (await import('./SendPage')).default;
    renderApp(<Send />);
    await user.type(await screen.findByLabelText('Recipient address'), bech32Encode('cosmos', new Uint8Array(20).fill(9)));
    const amount = screen.getByLabelText('Amount');
    const submit = screen.getByRole('button', { name: 'Review transaction' });
    const activityBefore = useWalletStore.getState().ledger.activity.length;

    await user.type(amount, '9999999');
    expect(await screen.findByText('Not enough ATOM in the Demo wallet.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await user.clear(amount);
    await user.type(amount, '10');
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    // reviewing changes nothing; the dialog repeats that no transfer happens
    const dialog = await screen.findByRole('dialog', { name: 'Review transaction' });
    expect(dialog).toHaveTextContent('No blockchain transfer occurs');
    expect(useWalletStore.getState().ledger.activity).toHaveLength(activityBefore);
    expect(useWalletStore.getState().ledger.balances.ATOM).toBe(1250);
    await user.click(within(dialog).getByRole('button', { name: 'Send (simulated)' }));

    const ledger = useWalletStore.getState().ledger;
    expect(ledger.balances.ATOM).toBeCloseTo(1250 - 10 - 0.0025, 8); // amount + simulated fee
    expect(ledger.activity[0]?.kind).toBe('send');
    // the send leaves a synthetic, explorer-visible transaction that cannot be mistaken for a chain transaction
    expect(ledger.activity[0]?.tx?.hash.startsWith('DE0DE0')).toBe(true);
    expect(ledger.activity[0]?.tx?.amount).toBe(10);
    expect(useToastStore.getState().toasts.at(-1)?.title).toBe('Sent (simulated)');
  });
});

describe('Swap: quote maths and balance checks', () => {
  beforeEach(async () => {
    await connectDemoWallet();
  });

  it('quotes a received amount with fee and impact, rejects overspending, and swaps balances', async () => {
    const user = userEvent.setup();
    const Swap = (await import('./SwapPage')).default;
    renderApp(<Swap />);
    const pay = await screen.findByLabelText('You pay');
    const receive = screen.getByLabelText('You receive');
    const submit = screen.getByRole('button', { name: 'Review swap' });
    await waitFor(() => expect(screen.getByText(/^1 ATOM ≈ [\d.]+ OSMO$/)).toBeInTheDocument());

    await user.type(pay, '5000');
    expect(await screen.findByText('Not enough ATOM in the Demo wallet.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await user.clear(pay);
    await user.type(pay, '10');
    await waitFor(() => expect(receive).not.toHaveValue(''));
    expect(screen.getByText('0.30%')).toBeInTheDocument(); // swap fee
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    const dialog = await screen.findByRole('dialog', { name: 'Review swap' });
    expect(useWalletStore.getState().ledger.balances.ATOM).toBe(1250); // still nothing changed
    await user.click(within(dialog).getByRole('button', { name: 'Confirm (simulated)' }));

    const b = useWalletStore.getState().ledger.balances;
    expect(b.ATOM).toBeCloseTo(1240, 8);
    expect(b.OSMO).toBeGreaterThan(8400);
    expect(useWalletStore.getState().ledger.activity[0]?.kind).toBe('swap');
  });
});

describe('Vote: casting and changing a simulated vote', () => {
  beforeEach(async () => {
    useChainStore.getState().setChain('cosmoshub');
    await connectDemoWallet();
  });

  it('records a vote in the Demo ledger and allows changing it', async () => {
    const user = userEvent.setup();
    const Vote = (await import('./VotePage')).default;
    renderApp(<Vote />);
    const [firstGroup] = await screen.findAllByRole('radiogroup', { name: 'Your vote' });
    await user.click((firstGroup as HTMLElement).querySelector('input[value="yes"]') as HTMLElement);
    await user.click(screen.getAllByRole('button', { name: 'Review vote' })[0] as HTMLElement);
    // nothing is recorded until the confirmation dialog is accepted, and it says the vote is simulated
    expect(Object.values(useWalletStore.getState().ledger.votes)).toEqual([]);
    const dialog = await screen.findByRole('dialog', { name: 'Review your vote' });
    expect(dialog).toHaveTextContent('not submitted on-chain');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm vote (simulated)' }));
    expect(Object.values(useWalletStore.getState().ledger.votes)).toEqual(['yes']);
    expect(await screen.findByText('Your vote: Yes')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Review vote' })[0]).toBeDisabled(); // same option selected
  });

  it('on a network with no live proposals it explains instead of showing an empty form', async () => {
    useChainStore.getState().setChain('osmosis');
    const Vote = (await import('./VotePage')).default;
    renderApp(<Vote />);
    expect(await screen.findByText('No live proposals')).toBeInTheDocument();
    useChainStore.getState().setChain('cosmoshub');
  });
});

describe('Demo wallet transactions in the explorer', () => {
  it('appear in the transaction list behind a "Demo wallet" filter and open as clearly synthetic records', async () => {
    const { makeDemoTx } = await import('@/lib/demoTx');
    const { getChain } = await import('@/services/chain/registry');
    const { getSimNow } = await import('@/stores/simStore');
    const user = userEvent.setup();
    await connectDemoWallet();
    const hub = getChain('cosmoshub');
    const address = useWalletStore.getState().address as string;
    const tx = makeDemoTx(hub, getSimNow(), { type: 'send', from: address, to: bech32Encode('cosmos', new Uint8Array(20).fill(4)), amount: 7, symbol: 'ATOM', seed: 'explorer-test' });
    useWalletStore.getState().recordTx('send', { amountAmt: 7, symbol: 'ATOM', to: 'cosmos1…' }, tx);

    const Transactions = (await import('./TransactionsPage')).default;
    const list = renderApp(<Transactions />);
    await user.click(await screen.findByRole('button', { name: 'Demo wallet (1)' }));
    expect(await screen.findByRole('link', { name: /^DE0DE0/ })).toBeInTheDocument();
    expect(screen.getAllByText('Demo wallet').length).toBeGreaterThan(0); // the row badge
    list.unmount();

    const Tx = (await import('./TransactionDetailPage')).default;
    renderApp(
      <Routes>
        <Route path="/explorer/transactions/:hash" element={<Tx />} />
      </Routes>,
      { route: `/explorer/transactions/${tx.hash}` },
    );
    expect(await screen.findByText(/created by the Demo wallet/)).toBeInTheDocument();
    expect(screen.getByText(/not a real blockchain hash/)).toBeInTheDocument();
  });
});
