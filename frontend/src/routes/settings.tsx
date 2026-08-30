import { AccountConnections } from '@/components/settings/account-connections';
import { createFileRoute } from '@tanstack/react-router';

function SettingsPage() {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <AccountConnections />
    </div>
  );
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});
