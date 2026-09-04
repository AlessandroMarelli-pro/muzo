import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { AccountConnections } from '@/components/settings/account-connections';
import { AiServiceSettings } from '@/components/settings/ai-service-settings';
import { createFileRoute } from '@tanstack/react-router';

function SettingsPage() {
  return (
    <PageShell className="max-w-2xl">
      <PageHeader title="Settings" description="Connect the services Muzo syncs with." />
      <AiServiceSettings />
      <AccountConnections />
    </PageShell>
  );
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});
