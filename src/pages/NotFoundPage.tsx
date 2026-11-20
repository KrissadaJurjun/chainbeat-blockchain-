import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { Panel } from '@/components/ui/Panel';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function NotFoundPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('notFound.title'));
  return (
    <Panel className="mx-auto mt-10 max-w-xl">
      <EmptyState
        titleAs="h1"
        icon={Compass}
        title={t('notFound.title')}
        description={t('notFound.body')}
        action={
          <Button asChild variant="primary">
            <Link to="/">{t('notFound.home')}</Link>
          </Button>
        }
      />
    </Panel>
  );
}
