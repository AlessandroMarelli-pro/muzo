import { Track } from '@/__generated__/types';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { StaticFilterOptionsData } from '@/hooks/useFilterOptions';
import { FilterState } from '@/hooks/useFiltering';
import { useTracksList } from '@/services/api-hooks';
import { ExtendedColumnSort } from '@/types/data-table';
import React from 'react';
import { DataTableSkeleton } from '../data-table/data-table-skeleton';
import { MusicView, type MusicViewMode } from './music-view';

interface TrackListProps {
  page: number;
  perPage: number;
  sort: ExtendedColumnSort<Track>[];
  view: MusicViewMode;
  staticFilterOptions: StaticFilterOptionsData & {
    isLoading: boolean;
  };
  filters: FilterState;
  handleFilterChange: (values: Record<string, string | string[] | null>) => void;
}

export const TrackList = React.memo<TrackListProps>(
  ({ page, perPage, sort, view, staticFilterOptions, filters, handleFilterChange }) => {
    const offset = (page - 1) * perPage;

    // Map frontend sort field names to backend field names
    const mapSortField = React.useCallback((frontendSort: string): string => {
      const sortMapping: Record<string, string> = {
        title: 'originalTitle',
        artist: 'originalArtist',
        album: 'originalAlbum',
        duration: 'duration',
        added: 'createdAt',
        createdAt: 'createdAt',
        listeningCount: 'listeningCount',
        tempo: 'tempo',
        danceabilityFeeling: 'danceabilityFeeling',
        arousalMood: 'arousalMood',
        valenceMood: 'valenceMood',
        libraryId: 'libraryId',
        favorite: 'isFavorite',
        lastPlayed: 'lastPlayedAt',
        lastScannedAt: 'lastScannedAt',
      };
      return sortMapping[frontendSort] || frontendSort;
    }, []);

    // Parse sorting state and extract orderBy and orderDirection
    const { orderBy, orderDirection } = React.useMemo(() => {
      if (Array.isArray(sort) && sort.length > 0) {
        const firstSort = sort[0];
        return {
          orderBy: mapSortField(firstSort.id),
          orderDirection: firstSort.desc ? 'desc' : ('asc' as 'asc' | 'desc'),
        };
      }

      return {
        orderBy: 'fileCreatedAt',
        orderDirection: 'desc' as 'asc' | 'desc',
      };
    }, [sort, mapSortField]);

    const queryParams = React.useMemo(
      () => ({
        limit: perPage,
        offset,
        orderBy,
        orderDirection,
      }),
      [perPage, offset, orderBy, orderDirection],
    );

    const { data, isLoading, isError, refetch } = useTracksList(queryParams);

    if (staticFilterOptions.isLoading) {
      return (
        <PageShell key="loading-track-list">
          <PageHeader title="Music" description="Everything in your library." />
          <DataTableSkeleton
            columnCount={10}
            rowCount={10}
            filterCount={4}
            withViewOptions
            withPagination
            withTopPagination={false}
            className="gap-4"
          />
        </PageShell>
      );
    }

    const tracks = data?.items;
    const totalPages = data?.pages || 0;

    return (
      <MusicView
        data={(tracks || []).map((t) => ({ ...t, tempo: t.mfTempo ?? null }))}
        pageCount={totalPages}
        view={view}
        staticFilterOptions={staticFilterOptions}
        initialPageSize={perPage}
        initialFilters={filters}
        handleFilterChange={handleFilterChange}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
      />
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.page === nextProps.page &&
      prevProps.perPage === nextProps.perPage &&
      prevProps.sort === nextProps.sort &&
      prevProps.view === nextProps.view &&
      prevProps.staticFilterOptions === nextProps.staticFilterOptions &&
      prevProps.filters === nextProps.filters
    );
  },
);
