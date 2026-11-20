import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ValidatorDetailView } from '@/components/governance/ValidatorDetailView';
import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/Demo';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { useValidatorDetail } from '@/hooks/useChainData';
import { paths } from '@/lib/paths';
import { useChain } from '@/stores/chainStore';

export default function ValidatorDetailPage() {
  const { t } = useTranslation();
  const chain = useChain();
  const { address = '' } = useParams();
  const name = useValidatorDetail(address).data?.validator.moniker;
  return (
    <div className="space-y-4">
      <PageHeader
        title={name ?? t('validators.detailTitle')}
        description={t('validators.detailDescription', { chain: chain.name })}
        badge={<DemoBadge label={t('common.simulated')} />}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to={paths.validators}>
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t('navigation.validators')}
            </Link>
          </Button>
        }
      />
      <Panel className="p-4 sm:p-5">
        <ValidatorDetailView address={address} />
      </Panel>
    </div>
  );
}
