import { Home } from '@/components/home/home';
import { librariesQueryOptions, recentlyPlayedQueryOptions } from '@/services/api-hooks';
import { libraryMetricsQueryOptions } from '@/services/metrics-hooks';
import { playlistsQueryOptions } from '@/services/playlist-hooks';
import { createFileRoute } from '@tanstack/react-router';

function HomePage() {
  return <Home />;
}

export const Route = createFileRoute('/')({
  component: HomePage,
  // Warm the caches on preload/navigation, but don't block rendering on them —
  // the page drives every section from `useQuery` with its own skeleton and
  // error states, so a slow metrics aggregation never freezes navigation.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(recentlyPlayedQueryOptions());
    void context.queryClient.prefetchQuery(libraryMetricsQueryOptions());
    void context.queryClient.prefetchQuery(librariesQueryOptions());
    void context.queryClient.prefetchQuery(playlistsQueryOptions());
  },
  preload: true,
});
