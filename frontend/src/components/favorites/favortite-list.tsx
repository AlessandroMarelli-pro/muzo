import { Badge } from '@/components/ui/badge';
import {
  useAudioPlayerActions,
  useAudioPlayerContext,
  useQueue,
} from '@/contexts/audio-player-context';
import { AnalysisStatus } from '@/services/api-hooks';
import { usePlaylistByName } from '@/services/playlist-hooks';
import { Music, Search, Sparkles } from 'lucide-react';
import React, { useEffect } from 'react';
import { Loading } from '../loading';
import { NoData } from '../no-data';
import { TrackRecommendations } from '../playlist/track-recommendations';
import MusicCard from '../track/music-card';
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
  const { playlist, isLoading, refetch } = usePlaylistByName('favorites');

  const tracks = playlist?.tracks?.map((track) => track.track) || [];
  const totalTracks = tracks?.length;

  const actions = useAudioPlayerActions();
  const { state } = useAudioPlayerContext();

  useEffect(() => {
    refetch().then(() => {
      handleSetQueue();
    });
  }, [state.isFavorite]);

  const { setQueue } = useQueue();
  const handleSetQueue = () => {
    setQueue(tracks);
  };
  const addTrackToFavorite = (trackId?: string) => {
    if (trackId) {
      actions.toggleFavorite(trackId);
    }
  };
  if (isLoading) {
    return <Loading />;
  }
  if (tracks?.length === 0) {
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
    <div className="p-4  space-y-4 flex flex-col z-0">
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
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center space-x-2">
          <Badge variant="outline">Total: {totalTracks}</Badge>
        </div>
      </div>

      {/* Track Grid/List */}
      <div
        className={
          'flex flex-nowrap max-w-screen overflow-x-scroll scroll-mb-0 gap-2'
        }
      >
        {tracks.map((track) => (
          <div className="min-w-[10vw] w-[10vw] max-h-65 h-65">
            <MusicCard key={track.id} track={track} setQueue={handleSetQueue} />
          </div>
        ))}
      </div>
      {/* Tabs */}
      <Tabs value={'recommendations'} onValueChange={() => {}}>
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
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
