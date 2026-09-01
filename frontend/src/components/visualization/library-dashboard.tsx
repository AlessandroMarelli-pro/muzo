import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLibrary, useLibraryTracks } from '@/services/api-hooks';
import { RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import MusicCard from '../track/music-card';
import { LibraryStats } from './library-stats';

interface LibraryDashboardProps {
  libraryId: string;
  onRefresh?: () => void;
}

export const LibraryDashboard: React.FC<LibraryDashboardProps> = ({ libraryId, onRefresh }) => {
  const { ref, inView } = useInView();

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useLibraryTracks(
    libraryId,
    { direction: 'AFTER', size: 40, cursor: null },
  );

  const pages = data?.pages ?? [];
  const tracks = pages?.flatMap((page) => page.items);

  const { data: library, isLoading: isLibraryLoading } = useLibrary(libraryId);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading || isLibraryLoading) {
    return (
      <PageShell>
        <PageHeader title="Library" description="Loading library data…" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </PageShell>
    );
  }

  const lastScan = library?.lastScanAt ? new Date(library.lastScanAt).toLocaleDateString() : '—';

  return (
    <PageShell>
      <PageHeader
        title={library?.name ?? 'Library'}
        description={`${library?.totalTracks?.toLocaleString()} tracks · ${library?.scanStatus} · updated ${lastScan}`}
      >
        <Badge variant="outline">{library?.scanStatus}</Badge>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </Button>
      </PageHeader>

      <LibraryStats library={library} tracks={tracks} isLoading={isLoading} />

      {/* Track grid */}
      <div className="space-y-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Tracks</p>
        <div className="grid justify-center gap-4 [grid-template-columns:repeat(auto-fill,300px)]">
          {tracks?.map((track) => (
            <MusicCard key={track.id} track={track} />
          ))}
        </div>
        <div className="flex justify-center pt-2" ref={ref}>
          {hasNextPage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading more…' : 'Load more'}
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  );
};
