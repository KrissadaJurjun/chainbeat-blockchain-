import { ArrowLeftRight, CircleCheck, CircleX, Droplets, Gift, Layers, Repeat, Send, Vote, Zap, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import type { TxStatus, TxType } from '@/types/domain';

const ICONS: Record<TxType, LucideIcon> = {
  send: Send,
  delegate: Layers,
  undelegate: Droplets,
  claim: Gift,
  vote: Vote,
  'ibc-transfer': ArrowLeftRight,
  swap: Repeat,
  other: Zap,
};

export const TX_TYPES: readonly TxType[] = ['send', 'ibc-transfer', 'swap', 'delegate', 'undelegate', 'claim', 'vote', 'other'];

export function TxTypeBadge({ type }: { type: TxType }) {
  const { t } = useTranslation();
  const Icon = ICONS[type];
  return (
    <Badge tone="neutral" className="gap-1.5">
      <Icon className="size-3" aria-hidden />
      {t(`txPage.types.${type}`)}
    </Badge>
  );
}

export function TxStatusBadge({ status }: { status: TxStatus }) {
  const { t } = useTranslation();
  // an icon next to the word, so the status never relies on colour alone
  const Icon = status === 'success' ? CircleCheck : CircleX;
  return (
    <Badge tone={status === 'success' ? 'green' : 'red'} className="gap-1">
      <Icon className="size-3" aria-hidden />
      {t(`txPage.status.${status}`)}
    </Badge>
  );
}
