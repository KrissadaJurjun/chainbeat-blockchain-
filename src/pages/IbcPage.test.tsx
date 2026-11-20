import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/utils';
import IbcPage from './IbcPage';

describe('IBC map', () => {
  it('zooms with the on-screen controls and resets the view', async () => {
    const user = userEvent.setup();
    renderApp(<IbcPage />);
    const controls = await screen.findByRole('group', { name: 'Zoom controls' });
    const level = within(controls).getByLabelText('Zoom level');
    expect(level).toHaveTextContent('100%');
    expect(within(controls).getByRole('button', { name: 'Reset view' })).toBeDisabled();
    await user.click(within(controls).getByRole('button', { name: 'Zoom in' }));
    expect(level).toHaveTextContent('125%');
    await user.click(within(controls).getByRole('button', { name: 'Zoom out' }));
    await user.click(within(controls).getByRole('button', { name: 'Zoom out' }));
    expect(level).toHaveTextContent('80%');
    await user.click(within(controls).getByRole('button', { name: 'Reset view' }));
    expect(level).toHaveTextContent('100%');
  });

  it('selecting a chain shows its details and busiest partner', async () => {
    const user = userEvent.setup();
    renderApp(<IbcPage />);
    const map = await screen.findByRole('group', { name: /IBC/i });
    const [first] = within(map).getAllByRole('button');
    await user.click(first as HTMLElement);
    expect(await screen.findByText('Busiest partner')).toBeInTheDocument();
    expect(screen.getByText('Share of IBC volume')).toBeInTheDocument();
  });
});
