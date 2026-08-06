'use client';

import { FilterButton } from '@/components/filters/filter-button';
import { Button } from '@/components/ui/button';
import { usePendingTracks } from '@/services/api-hooks';
import { useMemo, useState } from 'react';
import { PendingTrackCard } from './pending-track-card';

const PAGE_SIZE = 12;

export function PendingPage() {
  const [page, setPage] = useState(1);
  const offset = useMemo(() => (page - 1) * PAGE_SIZE, [page]);

  const {
    data: pendingTracksData,
    isLoading,
    isFetching,
    refetch,
  } = usePendingTracks({
    limit: PAGE_SIZE,
    offset,
    orderBy: 'createdAt',
    orderDirection: 'desc',
  });

  const tracks = pendingTracksData?.items ?? [];
  const totalPages = pendingTracksData?.pages ?? 0;
  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pending Tracks</h1>
          <p className="text-sm text-muted-foreground">
            Tracks not liked, disliked, or marked as banger.
          </p>
        </div>
        <FilterButton />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading pending tracks...</div>
      ) : tracks.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No pending tracks match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tracks.map((track) => (
            <PendingTrackCard key={track.id} track={track} onRated={refetch} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          disabled={!hasPreviousPage || isFetching}
          onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {pendingTracksData?.page ?? page} / {totalPages || 1}
        </span>
        <Button
          variant="outline"
          disabled={!hasNextPage || isFetching}
          onClick={() => setPage((currentPage) => currentPage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
