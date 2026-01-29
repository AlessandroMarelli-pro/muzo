import { Badge } from '@/components/ui/badge';
import {
  useAudioPlayerActions,
  useAudioPlayerContext,
} from '@/contexts/audio-player-context';
import { Route } from '@/routes/favorites';
import { AnalysisStatus } from '@/services/api-hooks';
import { useRouter } from '@tanstack/react-router';
import { Music, Search, Sparkles } from 'lucide-react';
import React, { useEffect } from 'react';
import { NoData } from '../no-data';
import { TrackRecommendations } from '../playlist/track-recommendations';
import { HorizontalMusicCardList } from '../track/music-card';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

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

export const FavoriteList: React.FC<TrackListProps> = ({
  viewMode = 'grid',
  searchQuery = '',
  onSearchChange,
}) => {
  const { playlist, recommendations } = Route.useLoaderData();
  const router = useRouter();
  const isLoading = false;
  const refetch = () => {
    router.invalidate();
  };

  const tracks = playlist?.tracks?.map((track) => track.track) || [];
  const totalTracks = tracks?.length;

  const actions = useAudioPlayerActions();
  const { state } = useAudioPlayerContext();

  useEffect(() => {
    refetch();
  }, [state.isFavorite]);

  const addTrackToFavorite = (trackId?: string) => {
    if (trackId) {
      actions.toggleFavorite(trackId);
    }
  };

  if (tracks?.length === 0 && !isLoading) {
    return (
      <NoData
        Icon={Music}
        title="No Tracks Found"
        subtitle={
          searchQuery
            ? `No tracks match "${searchQuery}"`
            : 'No tracks available in this library'
        }
        buttonAction={searchQuery ? () => onSearchChange('') : undefined}
        buttonLabel="Clear Search"
      />
    );
  }

  return (
    <div className="p-6  space-y-4 flex flex-col z-0">
      {/* Header */}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search tracks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border  rounded-md "
          />
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center space-x-2">
          <Badge variant="outline">Total: {totalTracks}</Badge>
        </div>
      </div>

      <HorizontalMusicCardList
        tracks={tracks || []}
        isLoading={isLoading}
        emptyMessage="No tracks found"
        numberOfCards={8}
      />
      {/* Tabs */}
      <Tabs value={'recommendations'} onValueChange={() => { }}>
        <TabsList>
          <TabsTrigger value="recommendations">
            <Sparkles className="h-4 w-4 " />
            Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          <TrackRecommendations
            playlistId={playlist?.id ?? ''}
            onTrackAdded={addTrackToFavorite}
            recommendations={recommendations}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
