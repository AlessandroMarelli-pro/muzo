import { SimpleMusicTrack } from '@/__generated__/types';
import { useFilterOptionsData } from '@/hooks/useFilterOptions';
import { getSortingStateParser } from '@/lib/parsers';
import { AnalysisStatus, useTracksList } from '@/services/api-hooks';
import { useQueryState } from 'nuqs';
import React from 'react';
import { Loading } from '../loading';
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

export const TrackList: React.FC<TrackListProps> = ({ viewMode = 'grid' }) => {
  console.log('render', 'TrackList');

  const staticFilterOptions = useFilterOptionsData();

  // Use URL state management for pagination and sorting
  const [page] = useQueryState('page', { defaultValue: '1' });
  const [perPage] = useQueryState('perPage', { defaultValue: '50' });

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
      { id: 'createdAt', desc: true },
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
      // Note: genres and subgenres are arrays, so direct sorting by these fields is not supported
      // genre: 'genres',
      // subgenre: 'subgenres',
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
      orderBy: 'createdAt',
      orderDirection: 'desc' as 'asc' | 'desc',
    };
    console.log('Using default sorting:', defaultResult);
    return defaultResult;
  }, [sorting, mapSortField]);

  const queryParams = {
    limit,
    offset,
    orderBy,
    orderDirection,
  };

  const { data, isLoading } = useTracksList(queryParams);

  if (staticFilterOptions.isLoading || isLoading) {
    return <Loading />;
  }
  const tracks = data?.tracks || [];
  const totalTracks = data?.total || 0;
  const totalPages = Math.ceil(totalTracks / limit);

  return (
    <div className="p-4 space-y-4 flex flex-col z-0">
      {/* Header */}

      {/* Track Grid/List */}
      <div
        className={
          viewMode === 'grid' ? 'flex flex-wrap gap-2 pb-16' : 'space-y-2'
        }
      >
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
    </div>
  );
};
