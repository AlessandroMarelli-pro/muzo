import type { Track } from '@/__generated__/types';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection,
} from '@/components/data-table/data-table-action-bar';
import { DataTableSortList } from '@/components/data-table/data-table-sort-list';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import { Separator } from '@/components/ui/separator';
import { useDataTable } from '@/hooks/use-data-table';
import { HeartOff } from 'lucide-react';
import * as React from 'react';
import { buildFavoritesColumns, type FavoriteTrack } from './favorites-columns';

interface FavoritesTableProps {
  data: FavoriteTrack[];
  isLoading?: boolean;
  onTogglePlay: (track: Track) => void;
  onRemove: (track: Track) => void;
  onBulkRemove: (tracks: Track[]) => void;
  currentTrackId?: string;
  isPlaying: boolean;
  isRemoving: boolean;
  pageSize?: number;
}

export function FavoritesTable({
  data,
  isLoading,
  onTogglePlay,
  onRemove,
  onBulkRemove,
  currentTrackId,
  isPlaying,
  isRemoving,
  pageSize = 10,
}: FavoritesTableProps) {
  const columns = React.useMemo(
    () =>
      buildFavoritesColumns({
        onTogglePlay,
        onRemove,
        currentTrackId,
        isPlaying,
        isRemoving,
      }),
    [onTogglePlay, onRemove, currentTrackId, isPlaying, isRemoving],
  );

  const pageCount = Math.max(1, Math.ceil(data.length / pageSize));

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    // Favorites arrive as one whole playlist, so the table does the slicing,
    // sorting and filtering in the browser.
    manualPagination: false,
    initialState: {
      sorting: [{ id: 'addedAt', desc: true }],
      columnPinning: { right: ['actions'] },
      pagination: { pageIndex: 0, pageSize },
      columnVisibility: { lastPlayedAt: false },
    },
    filterValues: {},
    setFilterValues: () => {},
    getRowId: (row) => row.id,
    enableAdvancedFilter: false,
  });

  const handleBulkRemove = () => {
    onBulkRemove(table.getFilteredSelectedRowModel().rows.map((row) => row.original));
    table.toggleAllRowsSelected(false);
  };

  return (
    <DataTable
      table={table}
      isLoading={isLoading}
      actionBar={
        <DataTableActionBar table={table}>
          <DataTableActionBarSelection table={table} />
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
          <DataTableActionBarAction
            tooltip="Remove from favorites"
            isPending={isRemoving}
            onClick={handleBulkRemove}
          >
            <HeartOff aria-hidden />
            Remove
          </DataTableActionBarAction>
        </DataTableActionBar>
      }
    >
      <DataTableToolbar table={table}>
        <DataTableSortList table={table} />
      </DataTableToolbar>
    </DataTable>
  );
}
