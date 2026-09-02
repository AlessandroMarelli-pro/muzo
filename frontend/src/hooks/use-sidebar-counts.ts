import { usePendingTracks } from '@/services/api-hooks';
import { libraryMetricsQueryOptions } from '@/services/metrics-hooks';
import { useQuery } from '@tanstack/react-query';

/**
 * Live counts surfaced as badges in the main navigation. Both queries are
 * shared with the pages that own them (same query keys), so this adds no
 * extra network cost once those pages have been visited — the pending query
 * asks for a single row purely to read `total`.
 */
export function useSidebarCounts() {
  const pending = usePendingTracks({ limit: 1, offset: 0 });
  const metrics = useQuery({
    ...libraryMetricsQueryOptions(),
    staleTime: 60_000,
  });

  return {
    pending: pending.data?.total ?? 0,
    favorites: metrics.data?.listeningStats?.favoriteCount ?? 0,
  };
}
