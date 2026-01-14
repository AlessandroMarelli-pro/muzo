import { SimpleMusicTrack } from '@/__generated__/types';
import { useFilterOptionsData } from '@/hooks/useFilterOptions';
import { getSortingStateParser } from '@/lib/parsers';
import { AnalysisStatus, useTracksList } from '@/services/api-hooks';
import { useQueryState } from 'nuqs';
import React from 'react';
import { DataTableSkeleton } from '../data-table/data-table-skeleton';
import { useFilterQueryParams } from './filter-qparams-hook';
import { MusicTable } from './music-table';

interface TrackListProps {
  viewMode?: 'grid' | 'list';
  sortBy?: 'title' | 'artist' | 'album' | 'duration' | 'added';
  sortOrder?: 'asc' | 'desc';
  filterStatus?: AnalysisStatus | 'all';
  searchQuery?: string;
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onSortChange: (
    sortBy: 'title' | 'artist' | 'album' | 'duration' | 'added',
  ) => void;
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  onFilterChange: (status: AnalysisStatus | 'all') => void;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
}

export const TrackList: React.FC<TrackListProps> = () => {
  console.log('render', 'TrackList');

  const staticFilterOptions = useFilterOptionsData();
  // Use URL state management for pagination and sorting
  const [page] = useQueryState('page', { defaultValue: '1' });
  const [perPage] = useQueryState('perPage', { defaultValue: '10' });

  useFilterQueryParams();

  // Define valid column IDs for sorting
  const validColumnIds = [
    'title',
    'artist',
    'album',
    'duration',
    'createdAt',
    'listeningCount',
    'tempo',
    'danceabilityFeeling',
    'arousalMood',
    'valenceMood',
    'libraryId',
    'genre',
    'subgenre',
    'favorite',
    'lastPlayed',
    'lastScannedAt',
    'fileCreatedAt',
  ];

  const [sorting] = useQueryState(
    'sort',
    getSortingStateParser<SimpleMusicTrack>(validColumnIds).withDefault([
      { id: 'fileCreatedAt', desc: false },
    ]),
  );

  // Convert URL parameters to the format expected by useTracksList
  const currentPage = parseInt(page || '1', 10);
  const limit = parseInt(perPage || '50', 10);
  const offset = (currentPage - 1) * limit;

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
    if (Array.isArray(sorting) && sorting.length > 0) {
      const firstSort = sorting[0];
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
    console.log('Using default sorting:', defaultResult);
    return defaultResult;
  }, [sorting, mapSortField]);

  const queryParams = React.useMemo(
    () => ({
      limit,
      offset,
      orderBy,
      orderDirection,
    }),
    [limit, offset, orderBy, orderDirection],
  );
  console.log('queryParams', queryParams);

  const { data, isLoading } = useTracksList(queryParams);

  if (staticFilterOptions.isLoading || isLoading) {
    return (
      <div className="p-6 flex flex-col" key="loading-track-list">
        <DataTableSkeleton
          columnCount={10}
          rowCount={10}
          filterCount={13}
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
        />
      </div>
    );
  }
  const tracks = data?.tracks || [];
  const totalTracks = data?.total || 0;
  const totalPages = Math.ceil(totalTracks / limit);
  return (
    <div className="p-6  flex flex-col z-0" key="track-list">
      <MusicTable
        data={tracks}
        pageCount={totalPages}
        onAddToQueue={(tracks: SimpleMusicTrack[]) =>
          console.log('Added to queue:', tracks)
        }
        isLoading={isLoading}
        staticFilterOptions={staticFilterOptions}
        initialPageSize={limit}
      />
    </div>
  );
};

TrackList.whyDidYouRender = true;
