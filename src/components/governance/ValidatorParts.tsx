import { CircleCheck, CircleMinus, Lock, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import type { ValidatorStatus } from '@/types/domain';

const STATUS: Record<ValidatorStatus, { tone: 'green' | 'neutral' | 'red'; icon: LucideIcon }> = {
  active: { tone: 'green', icon: CircleCheck },
  inactive: { tone: 'neutral', icon: CircleMinus },
  jailed: { tone: 'red', icon: Lock },
};

/** Validator status as an icon plus a word, never colour alone. */
export function ValidatorStatusBadge({ status }: { status: ValidatorStatus }) {
  const { t } = useTranslation();
  const { tone, icon: Icon } = STATUS[status];
  return (
    <Badge tone={tone} className="gap-1">
      <Icon className="size-3" aria-hidden />
      {t('validators.status.' + status)}
    </Badge>
  );
}
