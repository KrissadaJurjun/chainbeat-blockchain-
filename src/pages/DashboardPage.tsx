import { useTranslation } from 'react-i18next';
import { DevActivityPanel, ReposPanel } from '@/components/dashboard/DevPanels';
import { MetricsPanel } from '@/components/dashboard/MetricsPanel';
import { OverviewPanel } from '@/components/dashboard/OverviewPanel';
import { ProposalsPanel } from '@/components/dashboard/ProposalsPanel';
import { ValidatorsPanel } from '@/components/dashboard/ValidatorsPanel';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/**
 * The main dashboard. Layout follows the reference: a 7:3 first row (Overview + On-chain Metrics) and
 * a three-column second row (Proposals, Validators, Dev activity + Repositories).
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('navigation.dashboard'));
  return (
    <div className="space-y-4">
      <h1 className="sr-only">{t('navigation.dashboard')}</h1>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <OverviewPanel />
        <MetricsPanel />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ProposalsPanel />
        <ValidatorsPanel />
        <div className="grid gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-1 xl:grid-cols-1">
          <DevActivityPanel />
          <ReposPanel />
        </div>
      </div>
    </div>
  );
}
