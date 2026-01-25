import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAddTrackToPlaylist,
  useDeletePlaylist,
  usePlaylist,
  useUpdatePlaylistSorting,
} from '@/services/playlist-hooks';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  AudioWaveform,
  ChevronDown,
  Clock,
  Disc3,
  HeartPlus,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../ui/badge';
// Note: This app uses custom view state instead of routing
// The id should be passed as a prop from the parent component
import { Playlist } from '@/__generated__/types';
import {
  useAudioPlayerActions,
  useCurrentTrack,
} from '@/contexts/audio-player-context';
import { formatDuration } from '@/lib/utils';
import {
  useAddTrackToQueue,
  useQueue,
  useRemoveTrackFromQueue,
} from '@/services/queue-hooks';
import { Skeleton } from '../ui/skeleton';
import { AddTrackDrawer } from './add-track-drawer';
import { PlaylistDetailActions } from './playlist-detail-actions';
import { PlaylistDetailChart } from './playlist-detail-chart';
import { PlaylistDetailThirdParties } from './playlist-detail-third-parties';
import { PlaylistTracksList } from './playlist-tracks-list';
import { TrackRecommendations } from './track-recommendations';

interface PlaylistDetailProps {
  id: string;
  onBack: () => void;
}
const PlaylistMetadata = ({
  playlist,
  isLoading,
}: {
  playlist: Playlist | undefined;
  isLoading: boolean;
}) => {
  if (isLoading) {
    return Array.from({ length: 4 }).map((_, index) => (
      <Skeleton key={index} className="w-24 h-4" />
    ));
  }
  return (
    <div className="flex flex-row gap-1 items-center">
      <Badge variant="outline" className="text-xs ">
        <Disc3 className="h-4 w-4 " /> Tracks: {playlist?.numberOfTracks}
      </Badge>
      <Badge variant="outline" className="text-xs ">
        <Clock className="h-4 w-4" />
        Duration: {formatDuration(playlist?.totalDuration || 0)}
      </Badge>{' '}
      <Badge variant="outline" className="text-xs ">
        <HeartPlus className="h-4 w-4 " /> BPM: {playlist?.bpmRange.min} -{' '}
        {playlist?.bpmRange.max}
      </Badge>
      <Badge variant="outline" className="text-xs ">
        <AudioWaveform className="h-4 w-4 " /> Energy:{' '}
        {playlist?.energyRange.min} - {playlist?.energyRange.max}
      </Badge>
    </div>
  );
};
const PlaylistTitle = ({
  playlist,
  isLoading,
}: {
  playlist: Playlist | undefined;
  isLoading: boolean;
}) => {
  return (
    <div className="flex-1">
      <h1 className="text-base font-bold flex flex-row gap-1 items-center">
        {isLoading ? <Skeleton className="w-24 h-4" /> : playlist?.name}:
        <span className="text-muted-foreground">
          {isLoading ? (
            <Skeleton className="w-24 h-4" />
          ) : (
            playlist?.description
          )}
        </span>
      </h1>
    </div>
  );
};
export function PlaylistDetail({ id, onBack }: PlaylistDetailProps) {
  const { setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const { data: currentQueue = [] } = useQueue();
  const addTrackToQueue = useAddTrackToQueue();
  const removeTrackFromQueue = useRemoveTrackFromQueue();
  const [activeTab, setActiveTab] = useState('tracks');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingAsQueue, setIsSettingAsQueue] = useState(false);
  const [isAddTrackDrawerOpen, setIsAddTrackDrawerOpen] = useState(false);
  const {
    playlist,
    loading,
    error,
    refetch,
    syncToYouTube,
    syncToTidal,
    syncToSpotify,
  } = usePlaylist(id, 'default');
  const deletePlaylistMutation = useDeletePlaylist('default');
  const updatePlaylistSortingMutation = useUpdatePlaylistSorting('default');
  const addTrackToPlaylistMutation = useAddTrackToPlaylist();

  const addTrackToPlaylist = async (trackId: string) => {
    addTrackToPlaylistMutation.mutate({
      playlistId: playlist?.id || '',
      input: {
        trackId,
      },
    });
  };
  const handleDelete = async () => {
    if (
      !playlist ||
      !confirm(`Are you sure you want to delete "${playlist.name}"?`)
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await deletePlaylistMutation.mutateAsync(playlist.id);
      onBack();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetAsQueue = async () => {
    if (!playlist) return;

    setIsSettingAsQueue(true);
    try {
      // Remove all current queue items (ignore errors for individual removals)
      const removePromises = currentQueue.map((item) =>
        removeTrackFromQueue.mutateAsync(item.trackId).catch((err) => {
          console.warn(
            `Failed to remove track ${item.trackId} from queue:`,
            err,
          );
        }),
      );
      await Promise.all(removePromises);

      // Add all playlist tracks to queue (ignore errors for duplicates)
      const addPromises = playlist.tracks
        .filter((pt) => pt.track?.id)
        .map((pt) =>
          addTrackToQueue.mutateAsync(pt.track!.id).catch((err) => {
            // Ignore "already in queue" errors
            if (
              err?.message?.includes('already in the queue') ||
              err?.response?.errors?.[0]?.message?.includes(
                'already in the queue',
              )
            ) {
              return;
            }
            console.warn(`Failed to add track ${pt.track!.id} to queue:`, err);
          }),
        );
      await Promise.all(addPromises);

      // Optionally start playing the first track
      if (playlist.tracks[0]?.track) {
        setCurrentTrack(playlist.tracks[0].track);
        actions.play(playlist.tracks[0].track.id);
      }
    } catch (error) {
      console.error('Failed to set playlist as queue:', error);
    } finally {
      setIsSettingAsQueue(false);
    }
  };

  const handleUpdateSorting = async (
    sortingKey: 'position' | 'addedAt',
    sortingDirection: 'asc' | 'desc',
  ) => {
    if (!playlist) return;
    try {
      await updatePlaylistSortingMutation.mutateAsync({
        playlistId: playlist.id,
        input: { sortingKey, sortingDirection },
      });
    } catch (error) {
      console.error('Failed to update playlist sorting:', error);
    }
  };

  const currentSortingKey =
    (playlist as any)?.sorting?.sortingKey === 'addedAt'
      ? 'addedAt'
      : 'position';
  const currentSortingDirection =
    (playlist as any)?.sorting?.sortingDirection === 'desc' ? 'desc' : 'asc';

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">{error || 'Playlist not found'}</p>
        <Button onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to Playlists
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-8 flex flex-col z-0">
      {/* Header */}
      <div className="flex items-center gap-4 justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 " />
          Back
        </Button>
        <PlaylistTitle playlist={playlist} isLoading={loading} />
        <PlaylistMetadata
          playlist={playlist || undefined}
          isLoading={loading}
        />

        <div className="flex items-center gap-2">
          <PlaylistDetailActions
            playlist={playlist || undefined}
            isLoading={loading}
            isDeleting={isDeleting}
            isSettingAsQueue={isSettingAsQueue}
            onDelete={handleDelete}
            onSetAsQueue={handleSetAsQueue}
            onAddTrack={() => setIsAddTrackDrawerOpen(true)}
          />
          <PlaylistDetailThirdParties
            playlist={playlist || undefined}
            isLoading={loading}
            onSyncToYouTube={syncToYouTube}
            onSyncToTidal={syncToTidal}
            onSyncToSpotify={syncToSpotify}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={
                  loading ||
                  updatePlaylistSortingMutation.isPending ||
                  !playlist
                }
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Sort
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-sm font-semibold">Sort by</div>
              <DropdownMenuItem
                onClick={() => handleUpdateSorting('position', 'asc')}
                disabled={updatePlaylistSortingMutation.isPending}
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Manual (Ascending)
                {currentSortingKey === 'position' &&
                  currentSortingDirection === 'asc' && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleUpdateSorting('position', 'desc')}
                disabled={updatePlaylistSortingMutation.isPending}
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Manual (Descending)
                {currentSortingKey === 'position' &&
                  currentSortingDirection === 'desc' && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
              </DropdownMenuItem>
              <div className="h-px bg-border my-1" />
              <DropdownMenuItem
                onClick={() => handleUpdateSorting('addedAt', 'asc')}
                disabled={updatePlaylistSortingMutation.isPending}
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Added Date (Ascending)
                {currentSortingKey === 'addedAt' &&
                  currentSortingDirection === 'asc' && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleUpdateSorting('addedAt', 'desc')}
                disabled={updatePlaylistSortingMutation.isPending}
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Added Date (Descending)
                {currentSortingKey === 'addedAt' &&
                  currentSortingDirection === 'desc' && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Playlist Info */}
      <PlaylistDetailChart
        tracks={playlist?.tracks || []}
        isLoading={loading}
      />
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tracks">Tracks</TabsTrigger>
          <TabsTrigger value="recommendations">
            <Sparkles className="h-4 w-4" />
            Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tracks" className="space-y-4">
          <PlaylistTracksList
            playlist={playlist}
            onUpdate={refetch}
            isLoading={loading}
            addTrackToPlaylist={addTrackToPlaylist}
          />
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <TrackRecommendations
            playlistId={playlist?.id || ''}
            onTrackAdded={() => refetch()}
          />
        </TabsContent>
      </Tabs>

      <AddTrackDrawer
        open={isAddTrackDrawerOpen}
        onOpenChange={setIsAddTrackDrawerOpen}
        addTrackToPlaylist={addTrackToPlaylist}
        playlistId={id}
      />
    </div>
  );
}
