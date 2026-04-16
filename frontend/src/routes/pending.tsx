import { PendingPage } from '@/components/pending/pending-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/pending')({
  component: PendingPage,
});
