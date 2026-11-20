import { useEffect } from 'react';
import { Moon, Monitor, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/Menu';
import { Tip } from '@/components/ui/Tooltip';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUiStore, type ThemePreference } from '@/stores/uiStore';

/** Resolve the stored preference to a concrete theme. */
export function useResolvedTheme(): 'dark' | 'light' {
  const theme = useUiStore((s) => s.theme);
  const prefersLight = useMediaQuery('(prefers-color-scheme: light)');
  return theme === 'system' ? (prefersLight ? 'light' : 'dark') : theme;
}

/** Applies theme + motion preferences to <html>. Mounted once in the app shell. */
export function useApplyAppearance(): void {
  const resolved = useResolvedTheme();
  const motion = useUiStore((s) => s.motion);
  const density = useUiStore((s) => s.density);
  useEffect(() => {
    document.documentElement.dataset.density = density === 'compact' ? 'compact' : '';
  }, [density]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', resolved === 'light' ? '#ffffff' : '#071421');
  }, [resolved]);
  useEffect(() => {
    document.documentElement.dataset.motion = motion === 'reduce' ? 'reduce' : '';
  }, [motion]);
}

const ICONS = { system: Monitor, dark: Moon, light: Sun } as const;

export function ThemeSelector() {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const resolved = useResolvedTheme();
  const TriggerIcon = resolved === 'light' ? Sun : Moon;

  return (
    <DropdownMenu>
      <Tip label={t('theme.label')}>
        <DropdownMenuTrigger
          aria-label={t('theme.label')}
          className="grid size-9 place-items-center rounded-[10px] text-fg-2 outline-none transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-cyan/40 data-[state=open]:bg-hover"
        >
          <TriggerIcon className="size-[17px]" aria-hidden />
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent className="min-w-[180px]">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
          {(['system', 'dark', 'light'] as const).map((value) => {
            const Icon = ICONS[value];
            return (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon className="size-4 text-fg-3" aria-hidden />
                {t(`theme.${value}`)}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
