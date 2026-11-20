import { BookOpen, ExternalLink, Info, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogoMark, Wordmark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { copyText } from '@/components/ui/Copy';
import { APP_VERSION, DOCS_URL, GITHUB_URL } from '@/config/env';
import { paths } from '@/lib/paths';
import { useChain } from '@/stores/chainStore';
import { toast } from '@/stores/toastStore';

const linkClass = 'inline-flex items-center gap-1.5 rounded-md text-[12px] text-fg-2 transition-colors hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40';

/** Product footer: brand, version and network mode, honest data note, and only the links that really exist. */
export function Footer() {
  const { t } = useTranslation();
  const chain = useChain();

  const share = async (): Promise<void> => {
    const data = { title: 'ChainBeat', text: t('footer.tagline'), url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // user closed the share sheet
    }
    if (await copyText(window.location.href)) toast.success(t('footer.linkCopied'));
  };

  return (
    <footer className="px-3 pb-4 sm:px-4 lg:px-[18px] lg:pb-[18px]">
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-line pt-5">
        <div className="flex items-center gap-3.5">
          <LogoMark className="size-10 shrink-0" />
          <div>
            <Wordmark className="text-[19px]" />
            <p className="mt-1.5 text-[12px] text-fg-3">{t('footer.tagline')}</p>
            <p className="mt-0.5 text-[11.5px] tabular-nums text-fg-3">
              {t('footer.version', { version: APP_VERSION, mode: t('footer.modeDemo') })} · {chain.shortName}
            </p>
          </div>
        </div>
        <p className="order-last max-w-[44ch] text-[11.5px] leading-relaxed text-fg-3 lg:order-none">{t('footer.demo')}</p>
        <nav aria-label={t('footer.links')} className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to={paths.about} className={linkClass}>
            <Info className="size-3.5" aria-hidden /> {t('navigation.about')}
          </Link>
          {DOCS_URL ? (
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <BookOpen className="size-3.5" aria-hidden /> {t('footer.docs')} <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
          {GITHUB_URL ? (
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {t('footer.repository')} <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
          <Button variant="secondary" size="sm" onClick={share} className="rounded-full">
            <Share2 className="size-3.5" aria-hidden />
            {t('footer.share')}
          </Button>
        </nav>
      </div>
    </footer>
  );
}
