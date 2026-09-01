import { Track } from '@/__generated__/types';
import { cn } from '@/lib/utils';
import { memo } from 'react';
import { DataTablePagination } from '../data-table/data-table-pagination';
import { Skeleton } from '../ui/skeleton';
import type { Table } from '@tanstack/react-table';
import { TrackTile } from './track-tile';

const GRID_CLASS =
  'grid gap-4 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]';

interface MusicCardGridProps {
  tracks: Track[];
  isLoading: boolean;
  table: Table<Track>;
  /** Total across all pages, for the count line. */
  totalCount?: number;
}

function GridSkeleton({ count }: { count: number }) {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col overflow-hidden rounded-lg bg-card shadow-sm">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-1">
              <Skeleton className="h-4 w-12 rounded-full" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Card grid for the Music view. Empty / error / filtered-empty states are all
 * handled upstream in `MusicView` — this only ever renders with tracks or a
 * loading skeleton.
 */
export const MusicCardGrid = memo(function MusicCardGrid({
  tracks,
  isLoading,
  table,
  totalCount,
}: MusicCardGridProps) {
  const pageSize = table.getState().pagination.pageSize;

  if (isLoading) {
    return <GridSkeleton count={pageSize} />;
  }

  return (
    <div className={cn('flex flex-col gap-3')}>
      {totalCount != null && (
        <p className="px-1 text-muted-foreground text-sm">
          {totalCount.toLocaleString()} {totalCount === 1 ? 'track' : 'tracks'}
        </p>
      )}
      <div className={GRID_CLASS}>
        {tracks.map((track) => (
          <TrackTile key={track.id} track={track} />
        ))}
      </div>
      <DataTablePagination table={table} />
    </div>
  );
});
