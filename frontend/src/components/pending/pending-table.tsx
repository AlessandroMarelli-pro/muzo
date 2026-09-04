import type { Track } from '@/__generated__/types';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection,
} from '@/components/data-table/data-table-action-bar';
import { Separator } from '@/components/ui/separator';
import { useDataTable } from '@/hooks/use-data-table';
import type { FilterState } from '@/hooks/useFiltering';
import { cn } from '@/lib/utils';
import type { Table as TanstackTable } from '@tanstack/react-table';
import { Flame, ThumbsDown, ThumbsUp } from 'lucide-react';
import * as React from 'react';
import { buildPendingColumns, type RatingKind } from './pending-columns';

interface PendingTableProps {
  data: Track[];
  pageCount: number;
  isLoading: boolean;
  initialFilters: FilterState;
  onFilterChange: (values: Record<string, string | string[] | null>) => void;
  focusedTrackId: string | null;
  onFocusTrack: (trackId: string) => void;
  onRate: (trackId: string, kind: RatingKind) => void;
  onBulkRate: (trackIds: string[], kind: RatingKind) => void;
  onTogglePlay: (track: Track) => void;
  currentTrackId?: string;
  isPlaying: boolean;
  isRating: boolean;
  onTableReady?: (table: TanstackTable<Track>) => void;
  initialPageSize?: number;
}

export function PendingTable({
  data,
  pageCount,
  isLoading,
  initialFilters,
  onFilterChange,
  focusedTrackId,
  onFocusTrack,
  onRate,
  onBulkRate,
  onTogglePlay,
  currentTrackId,
  isPlaying,
  isRating,
  onTableReady,
  initialPageSize = 10,
}: PendingTableProps) {
  const columns = React.useMemo(
    () =>
      buildPendingColumns({
        onRate,
        onTogglePlay,
        currentTrackId,
        isPlaying,
        isRating,
      }),
    [onRate, onTogglePlay, currentTrackId, isPlaying, isRating],
  );

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    initialState: {
      pagination: { pageIndex: 0, pageSize: initialPageSize },
      columnVisibility: {
        mfDanceabilityFeeling: false,
        mfArousalMood: false,
        mfValenceMood: false,
      },
    },
    filterValues: initialFilters as unknown as Record<string, string | string[] | null>,
    setFilterValues: onFilterChange,
    getRowId: (row) => row.id,
    enableAdvancedFilter: false,
  });

  React.useEffect(() => {
    onTableReady?.(table);
  }, [table, onTableReady]);

  const selectedIds = table.getFilteredSelectedRowModel().rows.map((row) => row.original.id);

  const handleBulk = (kind: RatingKind) => {
    onBulkRate(selectedIds, kind);
    table.toggleAllRowsSelected(false);
  };

  return (
    <DataTable
      table={table}
      isLoading={isLoading}
      fixedLayout
      getRowProps={(row) => ({
        onClick: () => onFocusTrack(row.original.id),
        'data-focused': row.original.id === focusedTrackId,
        className: cn(
          'cursor-pointer',
          // Soft accent wash on the focused row; the left-edge marker bar is
          // drawn on the first cell by DataTable (the <tr>'s content-visibility
          // containment blocks a transition there). TableRow carries the
          // background/box-shadow transition.
          'data-[focused=true]:bg-accent/50 data-[focused=true]:ring-1 data-[focused=true]:ring-ring data-[focused=true]:ring-inset',
        ),
      })}
      actionBar={
        <DataTableActionBar table={table}>
          <DataTableActionBarSelection table={table} />
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
          <DataTableActionBarAction
            tooltip="Dislike selected"
            isPending={isRating}
            onClick={() => handleBulk('dislike')}
          >
            <ThumbsDown aria-hidden />
            Dislike
          </DataTableActionBarAction>
          <DataTableActionBarAction
            tooltip="Mark selected as banger"
            isPending={isRating}
            onClick={() => handleBulk('banger')}
          >
            <Flame aria-hidden />
            Banger
          </DataTableActionBarAction>
          <DataTableActionBarAction
            tooltip="Like selected"
            isPending={isRating}
            onClick={() => handleBulk('like')}
          >
            <ThumbsUp aria-hidden />
            Like
          </DataTableActionBarAction>
        </DataTableActionBar>
      }
    />
  );
}
