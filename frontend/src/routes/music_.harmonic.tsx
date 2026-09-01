import { HarmonicPage } from '@/components/harmonic/harmonic-page';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

function HarmonicRoute() {
  const { key } = Route.useSearch();
  return <HarmonicPage selectedKey={key} />;
}

export const Route = createFileRoute('/music_/harmonic')({
  component: HarmonicRoute,
  validateSearch: z.object({
    key: z.string().optional(),
  }),
});
