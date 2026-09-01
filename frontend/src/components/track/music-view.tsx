import { Track } from '@/__generated__/types';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { DataTableSortList } from '@/components/data-table/data-table-sort-list';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAudioPlayerActions, useCurrentTrack } from '@/contexts/audio-player-context';
import { useFilters } from '@/contexts/filter-context';
import { useDataTable } from '@/hooks/use-data-table';
import { FilterState } from '@/hooks/useFiltering';
import { StaticFilterOptionsData } from '@/hooks/useFilterOptions';
import { Link, useNavigate } from '@tanstack/react-router';
import { CircleDashed, LayoutGrid, TableProperties } from 'lucide-react';
import * as React from 'react';
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

  return (
    <PageShell key="music-view">
      <PageHeader title="Music" description="Everything in your library.">
        {view === 'cards' && <DataTableSortList table={table} />}
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

      {view === 'table' ? (
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
