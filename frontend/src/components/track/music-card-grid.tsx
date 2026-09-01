import { Track } from '@/__generated__/types';
import { cn } from '@/lib/utils';
import { Disc3 } from 'lucide-react';
import { memo } from 'react';
import { DataTablePagination } from '../data-table/data-table-pagination';
import { NoData } from '../no-data';
import { Skeleton } from '../ui/skeleton';
import type { Table } from '@tanstack/react-table';
import { TrackTile } from './track-tile';

const GRID_CLASS =
  'grid gap-4 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]';

interface MusicCardGridProps {
  tracks: Track[];
  isLoading: boolean;
  table: Table<Track>;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

function GridSkeleton() {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: 12 }).map((_, i) => (
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

export const MusicCardGrid = memo(function MusicCardGrid({
  tracks,
  isLoading,
  table,
  hasActiveFilters,
  onClearFilters,
}: MusicCardGridProps) {
  if (isLoading) {
    return <GridSkeleton />;
  }

  if (tracks.length === 0) {
    return (
      <div className="py-12">
        {hasActiveFilters ? (
          <NoData
            Icon={Disc3}
            title="No tracks match these filters"
            subtitle="Loosen the filters to see more of your library."
            buttonLabel="Clear filters"
            buttonAction={onClearFilters}
          />
        ) : (
          <NoData
            Icon={Disc3}
            title="Nothing here yet"
            subtitle="Point Muzo at a music folder and run a scan to fill your library."
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4')}>
      <div className={GRID_CLASS}>
        {tracks.map((track) => (
          <TrackTile key={track.id} track={track} />
        ))}
      </div>
      <DataTablePagination table={table} />
    </div>
  );
});
