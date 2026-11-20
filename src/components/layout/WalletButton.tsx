import { ChevronDown, Copy, LogOut, PieChart, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { copyText } from '@/components/ui/Copy';
import { DemoBadge } from '@/components/ui/Demo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/Menu';
import { shortHash } from '@/lib/utils';
import { deriveDemoAddress } from '@/services/wallet/adapters';
import { useChain } from '@/stores/chainStore';
import { toast } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import { useWalletStore } from '@/stores/walletStore';

/** The address to display. The Demo wallet re-derives its address for the selected network's prefix. */
export function useWalletAddress(): string | null {
  const chain = useChain();
  const status = useWalletStore((s) => s.status);
  const adapterId = useWalletStore((s) => s.adapterId);
  const address = useWalletStore((s) => s.address);
  if (status !== 'connected') return null;
  return adapterId === 'demo' ? deriveDemoAddress(chain) : address;
}

export function WalletButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openDialog = useUiStore((s) => s.openDialog);
  const status = useWalletStore((s) => s.status);
  const adapterId = useWalletStore((s) => s.adapterId);
  const disconnect = useWalletStore((s) => s.disconnect);
  const address = useWalletAddress();

  if (status !== 'connected' || !address) {
    return (
      <Button variant="primary" size="md" loading={status === 'connecting'} onClick={() => openDialog('wallet')} aria-label={t('wallet.connect')} className="px-2.5 sm:px-3.5 lg:h-[38px] 2xl:px-4">
        <Wallet className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t('wallet.connect')}</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t('wallet.account')}: ${shortHash(address, 6, 4)}${adapterId === 'demo' ? ` · ${t('common.demo')}` : ''}`}
        className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line-strong bg-card/70 px-2.5 text-[12.5px] font-medium text-fg outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-cyan/40 data-[state=open]:bg-hover"
      >
        <span className="size-2 rounded-full bg-green shadow-[0_0_6px_var(--c-green)]" aria-hidden />
        <span className="ltr-isolate hidden font-mono text-[12px] sm:inline">{shortHash(address, 6, 4)}</span>
        {adapterId === 'demo' ? <DemoBadge className="hidden 2xl:inline-flex" /> : null}
        <ChevronDown className="size-3.5 text-fg-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[260px]">
        <DropdownMenuLabel>{adapterId === 'demo' ? t('wallet.demoWallet') : t('wallet.connected')}</DropdownMenuLabel>
        <p className="ltr-isolate break-all px-2.5 pb-2 font-mono text-[11.5px] leading-snug text-fg-2">{address}</p>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            if (await copyText(address)) toast.success(t('common.copied'));
          }}
        >
          <Copy className="size-4 text-fg-3" aria-hidden /> {t('wallet.copyAddress')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/wallet/portfolio')}>
          <PieChart className="size-4 text-fg-3" aria-hidden /> {t('navigation.portfolio')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            disconnect();
            toast.show(t('wallet.disconnected'));
          }}
        >
          <LogOut className="size-4 text-fg-3" aria-hidden /> {t('wallet.disconnect')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
