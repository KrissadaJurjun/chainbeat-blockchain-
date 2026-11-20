import { ArrowLeftRight, Droplets, FileText, Gift, Layers, Send, Vote, Undo2, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DemoBadge } from '@/components/ui/Demo';
import { useFormat } from '@/hooks/useFormat';
import { localiseParams } from '@/lib/activityParams';
import { paths } from '@/lib/paths';
import { useWalletStore, type DemoActivityKind } from '@/stores/walletStore';

const ICONS: Record<DemoActivityKind, LucideIcon> = {
  swap: ArrowLeftRight,
  stake: Layers,
  unstake: Undo2,
  'liquid-stake': Droplets,
  send: Send,
  vote: Vote,
  claim: Gift,
  proposal: FileText,
};


/** The Demo wallet's recent simulated actions. */
export function ActivityList({ limit = 8 }: { limit?: number }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const activity = useWalletStore((s) => s.ledger.activity);
  const items = activity.slice(0, limit);

  if (items.length === 0) return <p className="px-1 py-6 text-center text-[12.5px] text-fg-3">{t('wallet.activity.empty')}</p>;

  return (
    <ul className="divide-y divide-line" aria-label={t('wallet.activity.title')}>
      {items.map((a) => {
        const Icon = ICONS[a.kind];
        return (
          <li key={a.id} className="flex items-start gap-3 py-2.5">
            <span className="icon-tile mt-0.5 size-8">
              <Icon className="size-4 text-fg-2" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] leading-snug text-fg">{t(`wallet.activity.${a.kind}`, localiseParams(a.params, fmt))}</p>
              <p className="mt-0.5 flex items-center gap-2 text-[11.5px] text-fg-3">
                {fmt.relative(a.ts)} <DemoBadge label={t('common.simulated')} className="h-[18px] px-1.5 text-[9.5px]" />
                {a.tx ? (
                  <Link to={paths.tx(a.tx.hash)} className="text-cyan hover:underline">
                    {t('wallet.confirm.viewTx')}
                  </Link>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
