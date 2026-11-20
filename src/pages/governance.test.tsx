import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChain } from '@/services/chain/registry';
import { getSimNow } from '@/stores/simStore';
import { useToastStore } from '@/stores/toastStore';
import { useWalletStore } from '@/stores/walletStore';
import { connectDemoWallet, renderApp } from '@/test/utils';
import CreateProposalPage from './CreateProposalPage';
import ProposalDetailPage from './ProposalDetailPage';
import ProposalsPage from './ProposalsPage';

const hub = getChain('cosmoshub');
const LATEST = hub.proposalsTotal; // the newest simulated proposal of the network

const GOVERNANCE_ROUTES = (
  <Routes>
    <Route path="/governance/proposals" element={<ProposalsPage />} />
    <Route path="/governance/proposals/:id" element={<ProposalDetailPage />} />
    <Route path="/governance/create" element={<CreateProposalPage />} />
  </Routes>
);

const SEARCH = 'Search proposals by title or number';
const cardTitles = (): string[] => screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '');

const demoProposal = (over: Partial<Parameters<ReturnType<typeof useWalletStore.getState>['addProposal']>[1]> = {}) =>
  useWalletStore.getState().addProposal(
    hub,
    { title: 'Zebra habitat grant programme', description: 'Fund wildlife corridors along the validator fibre routes.', type: 'other', deposit: 1000, ...over },
    getSimNow(),
  );

describe('Proposals list — search and filters', () => {
  it('finds a proposal by its number (with or without #), title, description or category, and says so when nothing matches', async () => {
    const user = userEvent.setup();
    const created = demoProposal();
    expect(created.id).toBe(LATEST + 1);
    renderApp(GOVERNANCE_ROUTES, { route: '/governance/proposals' });
    const search = await screen.findByRole('searchbox', { name: SEARCH });
    await waitFor(() => expect(cardTitles()).toContain('Zebra habitat grant programme'));
    expect(cardTitles().length).toBeGreaterThan(5);

    await user.type(search, String(created.id)); // a number: only the proposals whose number starts with it
    await waitFor(() => expect(cardTitles()).toEqual(['Zebra habitat grant programme']));
    await user.clear(search);

    await user.type(search, `#${created.id}`);
    await waitFor(() => expect(cardTitles()).toEqual(['Zebra habitat grant programme']));
    await user.clear(search);

    await user.type(search, 'ZEBRA'); // title, ignoring case
    await waitFor(() => expect(cardTitles()).toEqual(['Zebra habitat grant programme']));
    await user.clear(search);

    await user.type(search, 'wildlife corridors'); // description
    await waitFor(() => expect(cardTitles()).toEqual(['Zebra habitat grant programme']));
    await user.clear(search);

    await user.type(search, 'Other'); // the category, as shown on the card
    await waitFor(() => expect(cardTitles()).toContain('Zebra habitat grant programme'));
    expect(cardTitles().length).toBeLessThan(40);
    await user.clear(search);

    await user.type(search, 'no such proposal anywhere');
    expect(await screen.findByText('No proposals match this filter.')).toBeInTheDocument();
    expect(screen.queryByText('No live proposals')).not.toBeInTheDocument(); // that wording belongs to the Voting filter alone
    expect(cardTitles()).toEqual([]);
  });

  it('keeps the filter and the search in the address, and "back" from a proposal returns to the same view', async () => {
    const user = userEvent.setup();
    renderApp(GOVERNANCE_ROUTES, { route: '/governance/proposals?status=passed' });
    const first = (await screen.findAllByRole('heading', { level: 2 }))[0] as HTMLElement;
    const link = within(first).getByRole('link');
    const title = link.textContent ?? '';
    await user.click(link);
    expect(await screen.findByRole('heading', { level: 1, name: new RegExp(title.slice(0, 20)) })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/governance\/proposals\/\d+$/);
    await user.click(screen.getByRole('link', { name: 'Proposals' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/governance/proposals?status=passed');
    expect(await screen.findByRole('radio', { name: 'Passed', checked: true })).toBeInTheDocument();
  });

  it('a proposal opened directly goes back to the plain list', async () => {
    renderApp(GOVERNANCE_ROUTES, { route: `/governance/proposals/${LATEST}` });
    await screen.findByRole('heading', { level: 1, name: new RegExp(`^#${LATEST} ·`) });
    expect(screen.getByRole('link', { name: 'Proposals' })).toHaveAttribute('href', '/governance/proposals');
  });
});

describe('Proposal details', () => {
  const defined: string[] = [];
  afterEach(() => {
    for (const key of defined.splice(0)) Reflect.deleteProperty(navigator, key);
    vi.restoreAllMocks();
    useToastStore.setState({ toasts: [] });
  });

  it('lists who proposed it, when voting starts and ends and a history of the proposal', async () => {
    renderApp(GOVERNANCE_ROUTES, { route: `/governance/proposals/${LATEST}` });
    await screen.findByRole('heading', { level: 1, name: new RegExp(`^#${LATEST} ·`) });
    for (const label of ['Proposer', 'Submitted', 'Voting starts', 'Voting ends', 'Deposit', 'Voting period']) {
      expect(screen.getByText(label, { selector: 'dt' })).toBeInTheDocument();
    }
    const history = screen.getByRole('heading', { name: 'Proposal history' }).parentElement as HTMLElement;
    const steps = within(history).getAllByRole('listitem');
    expect(steps.map((s) => s.querySelector('p')?.textContent?.trim())).toEqual(['Submitted', 'Voting starts', 'Voting ends']);
    expect(within(history).queryByText('Result')).not.toBeInTheDocument(); // still open: no result yet
  });

  it('adds the result to the history once a proposal is decided', async () => {
    const list = renderApp(GOVERNANCE_ROUTES, { route: '/governance/proposals?status=passed' });
    const first = (await screen.findAllByRole('heading', { level: 2 }))[0] as HTMLElement;
    const number = within(first.closest('li') as HTMLElement).getByText(/^#\d+$/).textContent?.slice(1);
    list.unmount();

    renderApp(GOVERNANCE_ROUTES, { route: `/governance/proposals/${number}` });
    const history = (await screen.findByRole('heading', { name: 'Proposal history' })).parentElement as HTMLElement;
    const steps = within(history).getAllByRole('listitem');
    expect(steps).toHaveLength(4);
    expect(within(steps[3] as HTMLElement).getByText('Result')).toBeInTheDocument();
    expect(within(steps[3] as HTMLElement).getByText('Passed')).toBeInTheDocument();
  });

  it('a proposal that is still collecting its deposit has no voting start yet', async () => {
    const created = demoProposal({ title: 'Deposit still being collected', deposit: 10 });
    renderApp(GOVERNANCE_ROUTES, { route: `/governance/proposals/${created.id}` });
    await screen.findByRole('heading', { level: 1, name: /Deposit still being collected/ });
    expect(screen.queryByText('Voting starts', { selector: 'dt' })).not.toBeInTheDocument();
    const history = screen.getByRole('heading', { name: 'Proposal history' }).parentElement as HTMLElement;
    expect(within(history).getAllByRole('listitem')).toHaveLength(1);
  });

  it('shows the voting period chosen for a demo proposal', async () => {
    const created = demoProposal({ title: 'A three day vote', votingDays: 3 });
    renderApp(GOVERNANCE_ROUTES, { route: `/governance/proposals/${created.id}` });
    await screen.findByRole('heading', { level: 1, name: /A three day vote/ });
    const row = screen.getByText('Voting period', { selector: 'dt' }).parentElement as HTMLElement;
    expect(within(row).getByText('3 days')).toBeInTheDocument();
  });

  it('copies the proposal number, and shares the page by copying its link when the browser has no share sheet', async () => {
    const user = userEvent.setup();
    renderApp(GOVERNANCE_ROUTES, { route: `/governance/proposals/${LATEST}` });
    await screen.findByRole('heading', { level: 1, name: new RegExp(`^#${LATEST} ·`) });

    await user.click(screen.getByRole('button', { name: 'Copy proposal number' }));
    await expect(navigator.clipboard.readText()).resolves.toBe(String(LATEST));

    await user.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(useToastStore.getState().toasts.at(-1)?.title).toBe('Link copied to clipboard.'));
    await expect(navigator.clipboard.readText()).resolves.toBe(window.location.href);
  });

  it('uses the share sheet when there is one, and does nothing when the visitor closes it', async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    defined.push('share');
    renderApp(GOVERNANCE_ROUTES, { route: `/governance/proposals/${LATEST}` });
    const heading = await screen.findByRole('heading', { level: 1, name: new RegExp(`^#${LATEST} ·`) });
    const title = (heading.textContent ?? '').replace(`#${LATEST} · `, '');
    expect(title.length).toBeGreaterThan(5);

    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith({ title, url: window.location.href });
    expect(useToastStore.getState().toasts).toHaveLength(0); // the share sheet is its own confirmation

    share.mockRejectedValueOnce(new DOMException('closed', 'AbortError'));
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledTimes(2);
    expect(useToastStore.getState().toasts).toHaveLength(0); // closing the sheet is not an error and copies nothing
  });
});

describe('Create proposal — category, voting period, draft, cancel', () => {
  const fillIn = async (user: ReturnType<typeof userEvent.setup>, title = 'Fund the validator transparency report'): Promise<void> => {
    await user.type(await screen.findByLabelText('Title'), title);
    await user.click(screen.getByLabelText('Description'));
    await user.paste('A yearly report on validator uptime, commission changes and self-delegation, published for every delegator.');
  };
  const choose = async (user: ReturnType<typeof userEvent.setup>, field: RegExp, option: string): Promise<void> => {
    await user.click(await screen.findByRole('combobox', { name: field }));
    await user.click(await screen.findByRole('option', { name: option }));
  };

  it('offers the "Other" category and a choice of voting periods that includes the network\'s own', async () => {
    const user = userEvent.setup();
    await connectDemoWallet();
    renderApp(GOVERNANCE_ROUTES, { route: '/governance/create' });
    await user.click(await screen.findByRole('combobox', { name: /^Proposal type/ }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['Text', 'Parameter change', 'Community spend', 'Software upgrade', 'IBC', 'Other']);
    await user.keyboard('{Escape}');

    await user.click(await screen.findByRole('combobox', { name: /^Voting period/ }));
    const days = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(days).toEqual(['3 days', '5 days', '7 days', '14 days']);
    expect(days).toContain(`${hub.votingPeriodDays} days`);
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('combobox', { name: /^Voting period/ })).toHaveTextContent(`${hub.votingPeriodDays} days`); // the network's own is the default
  });

  it('saves the form as a draft in this browser, restores it on the next visit and can discard it', async () => {
    const user = userEvent.setup();
    await connectDemoWallet();
    const first = renderApp(GOVERNANCE_ROUTES, { route: '/governance/create' });
    expect(await screen.findByRole('button', { name: 'Save draft' })).toBeDisabled(); // nothing written yet: nothing to save
    await fillIn(user);
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    await choose(user, /^Proposal type/, 'Other');
    await choose(user, /^Voting period/, '3 days');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(useToastStore.getState().toasts.at(-1)?.title).toBe('Draft saved in this browser.');
    expect(useWalletStore.getState().ledger.draft).toMatchObject({ chainId: 'cosmoshub', type: 'other', title: 'Fund the validator transparency report', votingDays: '3' });
    expect(JSON.parse(window.localStorage.getItem('chainbeat.wallet') ?? '{}').state.ledger.draft.title).toBe('Fund the validator transparency report');
    expect(useWalletStore.getState().ledger.proposals).toHaveLength(0); // a draft is not a proposal
    first.unmount();

    renderApp(GOVERNANCE_ROUTES, { route: '/governance/create' });
    const form = await screen.findByRole('form', { name: 'Create Proposal' });
    expect(within(form).getByRole('status')).toHaveTextContent('Your saved draft was restored.');
    expect(screen.getByLabelText('Title')).toHaveValue('Fund the validator transparency report');
    expect(screen.getByRole('combobox', { name: /^Proposal type/ })).toHaveTextContent('Other');
    expect(screen.getByRole('combobox', { name: /^Voting period/ })).toHaveTextContent('3 days');

    await user.click(screen.getByRole('button', { name: 'Discard draft' }));
    expect(useWalletStore.getState().ledger.draft).toBeNull();
    expect(within(form).queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: /^Proposal type/ })).toHaveTextContent('Text');
  });

  it('"Cancel" leaves for the proposals list without saving or submitting anything', async () => {
    const user = userEvent.setup();
    await connectDemoWallet();
    renderApp(GOVERNANCE_ROUTES, { route: '/governance/create' });
    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/governance\/proposals$/);
    expect(useWalletStore.getState().ledger.draft).toBeNull();
    expect(useWalletStore.getState().ledger.proposals).toHaveLength(0);
  });

  it('reviews the proposal with its voting period, then submits it with that period and clears the draft', async () => {
    const user = userEvent.setup();
    await connectDemoWallet();
    renderApp(GOVERNANCE_ROUTES, { route: '/governance/create' });
    await fillIn(user);
    await choose(user, /^Proposal type/, 'Other');
    await choose(user, /^Voting period/, '5 days');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(useWalletStore.getState().ledger.draft).not.toBeNull();

    const submit = screen.getByRole('button', { name: 'Submit proposal (simulated)' });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    const dialog = await screen.findByRole('dialog', { name: 'Submit this demo proposal?' });
    // nothing is created until the visitor confirms
    expect(useWalletStore.getState().ledger.proposals).toHaveLength(0);
    const row = (label: string): HTMLElement => within(dialog).getByText(label, { selector: 'dt' }).parentElement as HTMLElement;
    expect(row('Proposal type')).toHaveTextContent('Other');
    expect(row('Voting period')).toHaveTextContent('5 days');
    await user.click(within(dialog).getByRole('button', { name: 'Submit (simulated)' }));

    const mine = useWalletStore.getState().ledger.proposals;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ type: 'other', votingDays: 5, title: 'Fund the validator transparency report', id: LATEST + 1 });
    expect(useWalletStore.getState().ledger.draft).toBeNull(); // submitted: the saved draft is gone
    expect(await screen.findByRole('heading', { level: 1, name: new RegExp(`^#${LATEST + 1} ·`) })).toBeInTheDocument();
    expect(within(screen.getByText('Voting period', { selector: 'dt' }).parentElement as HTMLElement).getByText('5 days')).toBeInTheDocument();
  });
});
