import { SettingsShell, type SettingsSection } from '@/components/settings/settings-shell';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';

function SettingsPage() {
  const { section } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <SettingsShell
      section={section}
      onSectionChange={(next: SettingsSection) =>
        navigate({ search: (prev) => ({ ...prev, section: next }) })
      }
    />
  );
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
  validateSearch: z.object({
    section: z.enum(['analysis', 'streaming', 'discovery']).default('analysis'),
  }),
});
