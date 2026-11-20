import { CircleUserRound, FlaskConical, Info, LogIn, LogOut, PieChart, Settings, UserPlus, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/Menu';
import { paths } from '@/lib/paths';
import { hashString } from '@/lib/prng';
import { shortHash } from '@/lib/utils';
import { initialOf } from '@/services/auth/accounts';
import { useAuthStore, useCurrentAccount } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import { useWalletStore } from '@/stores/walletStore';
import { useWalletAddress } from './WalletButton';

/** Deterministic avatar gradient derived from an address or account id (or a neutral one for guests). */
function avatarStyle(seed: string | null): { background: string } {
  if (!seed) return { background: 'linear-gradient(135deg, #3a5a82, #1d3550)' };
  const h = hashString(seed) % 360;
  return { background: `linear-gradient(135deg, hsl(${h} 78% 62%), hsl(${(h + 70) % 360} 78% 48%))` };
}

export function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openDialog = useUiStore((s) => s.openDialog);
  const label = useWalletStore((s) => s.label);
  const address = useWalletAddress();
  const account = useCurrentAccount();
  const name = account ? account.username : address ? (label ?? t('wallet.connected')) : t('user.guest');

  const signOut = (): void => {
    useAuthStore.getState().signOut();
    toast.success(t('auth.toast.signedOut'));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t('user.menu')}: ${name}`}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-active-line bg-active/70 p-1 pe-1 lg:h-[38px] text-[12.5px] font-medium text-fg outline-none transition-colors hover:bg-active focus-visible:ring-2 focus-visible:ring-cyan/40 2xl:pe-3.5"
      >
        <span className="grid size-7 place-items-center rounded-full text-[13px] font-bold text-white shadow-inner" style={avatarStyle(account?.id ?? address)}>
          {account ? <span aria-hidden>{initialOf(account)}</span> : <CircleUserRound className="size-[17px]" aria-hidden />}
        </span>
        <span className="hidden max-w-[110px] truncate 2xl:inline">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[250px]">
        <DropdownMenuLabel>{name}</DropdownMenuLabel>
        {account ? (
          <p dir="ltr" className="ltr-isolate break-all px-2.5 pb-1 text-[11.5px] text-fg-3">
            {account.email}
          </p>
        ) : null}
        {!account || address ? (
          <p className="ltr-isolate px-2.5 pb-2 font-mono text-[11.5px] text-fg-3">{address ? shortHash(address, 10, 6) : t('user.notConnected')}</p>
        ) : null}
        <DropdownMenuSeparator />
        {account ? (
          <DropdownMenuItem onSelect={() => navigate(paths.myAccount)}>
            <UserRound className="size-4 text-fg-3" aria-hidden /> {t('auth.menu.account')}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onSelect={() => navigate(paths.login)}>
              <LogIn className="size-4 text-fg-3" aria-hidden /> {t('auth.menu.signIn')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(paths.register)}>
              <UserPlus className="size-4 text-fg-3" aria-hidden /> {t('auth.menu.register')}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(paths.portfolio)}>
          <PieChart className="size-4 text-fg-3" aria-hidden /> {t('navigation.portfolio')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(paths.settings)}>
          <Settings className="size-4 text-fg-3" aria-hidden /> {t('user.settings')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openDialog('demo')}>
          <FlaskConical className="size-4 text-fg-3" aria-hidden /> {t('demo.controls')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(paths.about)}>
          <Info className="size-4 text-fg-3" aria-hidden /> {t('user.about')}
        </DropdownMenuItem>
        {account ? (
          <DropdownMenuItem onSelect={signOut}>
            <LogOut className="size-4 text-fg-3" aria-hidden /> {t('auth.menu.signOut')}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
