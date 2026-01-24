import { SimpleMusicTrack } from '@/__generated__/types';
import { StaticFilterOptionsData } from '@/hooks/useFilterOptions';
import { FilterState } from '@/hooks/useFiltering';
import { useTracksList } from '@/services/api-hooks';
import { ExtendedColumnSort } from '@/types/data-table';
import React from 'react';
import { DataTableSkeleton } from '../data-table/data-table-skeleton';
import { MusicTable } from './music-table';

interface TrackListProps {
  page: number;
  perPage: number;
  sort: ExtendedColumnSort<SimpleMusicTrack>[];
  staticFilterOptions: StaticFilterOptionsData & {
    isLoading: boolean;
  };
  filters: FilterState;
  handleFilterChange: (
    values: Record<string, string | string[] | null>,
  ) => void;
}

export const TrackList = React.memo<TrackListProps>(
  ({
    page,
    perPage,
    sort,
    staticFilterOptions,
    filters,
    handleFilterChange,
  }) => {

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
        const result = {
          orderBy: mapSortField(firstSort.id),
          orderDirection: firstSort.desc ? 'desc' : ('asc' as 'asc' | 'desc'),
        };

        return result;
      }

      const defaultResult = {
        orderBy: 'fileCreatedAt',
        orderDirection: 'asc' as 'asc' | 'desc',
      };
      return defaultResult;
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

    const { data, isLoading } = useTracksList(queryParams);

    if (staticFilterOptions.isLoading || isLoading) {
      return (
        <div className="p-6 flex flex-col " key="loading-track-list">
          <DataTableSkeleton
            columnCount={10}
            rowCount={10}
            filterCount={18}
            cellWidths={[
              '100px',
              '100px',
              '100px',
              '100px',
              '100px',
              '100px',
              '100px',
              '100px',
              '100px',
              '100px',
            ]}
            withViewOptions={true}
            withPagination={true}
            withTopPagination={true}
            className='gap-4'
          />
        </div>
      );
    }
    const tracks = data?.tracks || [];
    const totalTracks = data?.total || 0;
    const totalPages = Math.ceil(totalTracks / perPage);
    return (
      <div className="p-6  flex flex-col z-0" key="track-list">
        <MusicTable
          data={tracks}
          pageCount={totalPages}
          staticFilterOptions={staticFilterOptions}
          initialPageSize={perPage}
          initialFilters={filters}
          handleFilterChange={handleFilterChange}
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.page === nextProps.page &&
      prevProps.perPage === nextProps.perPage &&
      prevProps.sort === nextProps.sort &&
      prevProps.staticFilterOptions === nextProps.staticFilterOptions &&
      prevProps.filters === nextProps.filters
    );
  },
);
TrackList.whyDidYouRender = true;
