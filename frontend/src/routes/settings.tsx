import { createFileRoute } from '@tanstack/react-router';

function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <p className="text-muted-foreground">
        Application settings will appear here
      </p>
    </div>
  );
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});
