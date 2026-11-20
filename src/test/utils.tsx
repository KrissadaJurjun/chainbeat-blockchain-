import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { useChainStore } from '@/stores/chainStore';
import { useWalletStore } from '@/stores/walletStore';
import { getChain } from '@/services/chain/registry';

/** Renders the current router location so tests can assert on navigation. */
export function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

export function renderApp(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  const result = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[route]}>
          {ui}
          <LocationProbe />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { client, ...result };
}

/** Put the app into "Demo wallet connected" state without going through the dialog. */
export async function connectDemoWallet(chainId = 'cosmoshub'): Promise<void> {
  useChainStore.getState().setChain(chainId);
  await useWalletStore.getState().connect('demo', getChain(chainId));
}
