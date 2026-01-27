import { Home } from '@/components/home/home';
import {
  recentlyPlayedQueryOptions,
} from '@/services/api-hooks';
import { libraryMetricsQueryOptions } from '@/services/metrics-hooks';
import { createFileRoute } from '@tanstack/react-router';

function HomePage() {
  return <Home />;
}

export const Route = createFileRoute('/')({
  component: HomePage,
  loader: async ({ context }) => {
    const [recentlyPlayedData, metrics] = await Promise.all([
      context.queryClient.ensureQueryData(recentlyPlayedQueryOptions()),
      context.queryClient.ensureQueryData(libraryMetricsQueryOptions()),
    ]);
    return { recentlyPlayed: recentlyPlayedData, metrics };
  },
  preload: true,
});
