import { Track } from '@/__generated__/types';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { DataTableSortList } from '@/components/data-table/data-table-sort-list';
import { NoData } from '@/components/no-data';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAudioPlayerActions, useCurrentTrack } from '@/contexts/audio-player-context';
import { useFilters } from '@/contexts/filter-context';
import { useDataTable } from '@/hooks/use-data-table';
import { FilterState } from '@/hooks/useFiltering';
import { StaticFilterOptionsData } from '@/hooks/useFilterOptions';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  CircleDashed,
  FolderPlus,
  LayoutGrid,
  PlugZap,
  SearchX,
  TableProperties,
} from 'lucide-react';
import * as React from 'react';
import { LibraryStatusStrip } from './library-status-strip';
import { MusicCardGrid } from './music-card-grid';
import { buildMusicColumns, MusicTable } from './music-table';
import { useTrackKeyboardNav } from './use-track-keyboard-nav';

export type MusicViewMode = 'cards' | 'table';

interface MusicViewProps {
  data: Track[];
  pageCount: number;
  view: MusicViewMode;
  staticFilterOptions: StaticFilterOptionsData;
  initialPageSize: number;
  initialFilters: FilterState;
  handleFilterChange: (values: Record<string, string | string[] | null>) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export const MusicView = React.memo<MusicViewProps>(function MusicView({
  data,
  pageCount,
  view,
  staticFilterOptions,
  initialPageSize,
  initialFilters,
  handleFilterChange,
  isLoading,
  isError,
  onRetry,
}) {
  const navigate = useNavigate({ from: '/music' });
  const actions = useAudioPlayerActions();
  const { setCurrentTrack } = useCurrentTrack();
  const { resetFilters, hasActiveFilters } = useFilters();

  const columns = React.useMemo(
    () => buildMusicColumns(staticFilterOptions, actions, setCurrentTrack),
    [staticFilterOptions, actions, setCurrentTrack],
  );

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    initialState: {
      sorting: [{ id: 'fileCreatedAt', desc: true }],
      columnPinning: { right: ['actions'] },
      pagination: { pageIndex: 0, pageSize: initialPageSize },
      columnVisibility: {
        mfDanceabilityFeeling: false,
        mfArousalMood: false,
        mfValenceMood: false,
      },
    },
    filterValues: initialFilters as unknown as Record<string, string | string[] | null>,
    setFilterValues: handleFilterChange,
    getRowId: (row) => row.id,
    enableAdvancedFilter: false,
  });

  const setView = React.useCallback(
    (next: string) => {
      if (next !== 'cards' && next !== 'table') return;
      void navigate({ search: (prev) => ({ ...prev, view: next }) });
    },
    [navigate],
  );

  useTrackKeyboardNav({
    tracks: data,
    onPreviousPage: table.previousPage,
    onNextPage: table.nextPage,
  });

  const isEmpty = !isLoading && !isError && data.length === 0;

  return (
    <PageShell key="music-view">
      <PageHeader title="Music" description="Everything in your library.">
        {view === 'cards' && !isEmpty && !isError && <DataTableSortList table={table} />}
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={setView}
          variant="outline"
          size="sm"
          aria-label="View mode"
        >
          <ToggleGroupItem value="table" aria-label="Table view">
            <TableProperties className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="cards" aria-label="Card view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <Button asChild variant="outline" size="sm">
          <Link to="/music/harmonic">
            <CircleDashed className="h-4 w-4" />
            Harmonic
          </Link>
        </Button>
      </PageHeader>

      <LibraryStatusStrip />

      {isError ? (
        <div className="py-12">
          <NoData
            Icon={PlugZap}
            title="Can't reach the library service"
            subtitle="The connection to Muzo's backend failed. Check that it's running, then try again."
            buttonLabel="Retry"
            buttonAction={onRetry}
          />
        </div>
      ) : isEmpty && !hasActiveFilters ? (
        <div className="py-12">
          <NoData
            Icon={FolderPlus}
            title="Your library is empty"
            subtitle="Point Muzo at a music folder and run a scan to begin building your library."
            buttonLabel="Add a library"
            buttonAction={() => void navigate({ to: '/libraries' })}
          />
        </div>
      ) : isEmpty && hasActiveFilters ? (
        <div className="py-12">
          <NoData
            Icon={SearchX}
            title="No tracks match these filters"
            subtitle="Loosen or clear the filters to see more of your library."
            buttonLabel="Clear filters"
            buttonAction={resetFilters}
          />
        </div>
      ) : view === 'table' ? (
        <MusicTable table={table} isLoading={isLoading} />
      ) : (
        <MusicCardGrid
          tracks={data}
          isLoading={isLoading}
          table={table}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={resetFilters}
        />
      )}
    </PageShell>
  );
});
