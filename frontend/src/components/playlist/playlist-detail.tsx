import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
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
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  Clock,
  Compass,
  Disc3,
  Gauge,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
// Note: This app uses custom view state instead of routing
// The id should be passed as a prop from the parent component
import { Playlist } from '@/__generated__/types';
import { useAudioPlayerActions, useCurrentTrack } from '@/contexts/audio-player-context';
import { formatDuration } from '@/lib/utils';
import { Route } from '@/routes/playlists.$playlistId';
import { useAddTracksToQueue, useQueue, useRemoveTrackFromQueue } from '@/services/queue-hooks';
import { useRouter } from '@tanstack/react-router';
import { Skeleton } from '../ui/skeleton';
import { AddTrackDrawer } from './add-track-drawer';
import { PlaylistDetailActions } from './playlist-detail-actions';
import { PlaylistDetailChart } from './playlist-detail-chart';
import { PlaylistDetailThirdParties } from './playlist-detail-third-parties';
import { PlaylistDiscovery } from './playlist-discovery';
import { PlaylistHqBatchDownloadDialog } from './playlist-hq-batch-download-dialog';
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
    return (
      <div className="flex flex-row gap-1 items-center">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="w-24 h-5 rounded-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-row flex-wrap gap-1 items-center">
      <Badge variant="outline" className="text-xs">
        <Disc3 className="h-4 w-4" aria-hidden />
        {playlist?.stats?.numberOfTracks ?? 0} tracks
      </Badge>
      <Badge variant="outline" className="text-xs">
        <Clock className="h-4 w-4" aria-hidden />
        {formatDuration(playlist?.stats?.totalDuration || 0) || '0s'}
      </Badge>
      {playlist?.stats?.bpmRange?.min != null && playlist?.stats?.bpmRange?.max != null && (
        <Badge variant="outline" className="text-xs">
          <Gauge className="h-4 w-4" aria-hidden />
          <span className="font-mono tabular-nums">
            {playlist.stats.bpmRange.min}–{playlist.stats.bpmRange.max}
          </span>{' '}
          BPM
        </Badge>
      )}
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
    <div className="min-w-0 flex-1">
      <h1 className="text-2xl font-bold leading-tight tracking-tight truncate">
        {isLoading ? <Skeleton className="w-48 h-7" /> : playlist?.name}
      </h1>
      {isLoading ? (
        <Skeleton className="mt-1 w-64 h-4" />
      ) : (
        playlist?.description && (
          <p className="mt-1 text-sm text-muted-foreground truncate">{playlist.description}</p>
        )
      )}
    </div>
  );
};
export function PlaylistDetail({ id, onBack }: PlaylistDetailProps) {
  const { playlist, recommendations } = Route.useLoaderData();
  const router = useRouter();
  const loading = false;
  const { setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const { data: currentQueue = [] } = useQueue();
  const addTracksToQueue = useAddTracksToQueue();
  const removeTrackFromQueue = useRemoveTrackFromQueue();
  const [activeTab, setActiveTab] = useState('tracks');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingAsQueue, setIsSettingAsQueue] = useState(false);
  const [isAddTrackDrawerOpen, setIsAddTrackDrawerOpen] = useState(false);
  const [isHqBatchDownloadDialogOpen, setIsHqBatchDownloadDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isReplaceQueueDialogOpen, setIsReplaceQueueDialogOpen] = useState(false);
  const { syncToYouTube, syncToTidal, syncToSpotify } = usePlaylist(id, 'default');
  const deletePlaylistMutation = useDeletePlaylist();
  const updatePlaylistSortingMutation = useUpdatePlaylistSorting('default');
  const addTrackToPlaylistMutation = useAddTrackToPlaylist();

  const refetch = useCallback(() => {
    router.invalidate();
  }, [router]);

  const addTrackToPlaylist = useCallback(
    async (trackId: string, artist: string, title: string) => {
      try {
        await addTrackToPlaylistMutation.mutateAsync({
          playlistId: playlist?.id || '',
          input: { trackId },
          artist,
          title,
        });
        refetch();
      } catch (error) {
        console.error('Failed to add track to playlist:', error);
        toast.error('Could not add that track to the playlist. Please try again.');
      }
    },
    [addTrackToPlaylistMutation, playlist?.id, refetch],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!playlist) return;
    setIsDeleting(true);
    try {
      await deletePlaylistMutation.mutateAsync({ id: playlist.id, name: playlist.name });
      setIsDeleteDialogOpen(false);
      onBack();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      toast.error('Could not delete this playlist. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [playlist, deletePlaylistMutation, onBack]);

  const replaceQueueWithPlaylist = useCallback(async () => {
    if (!playlist) return;
    setIsSettingAsQueue(true);
    try {
      // Clear the existing queue (per-item failures are non-fatal).
      await Promise.all(
        currentQueue.map((item) =>
          removeTrackFromQueue.mutateAsync(item.trackId).catch((err) => {
            console.warn(`Failed to remove track ${item.trackId} from queue:`, err);
          }),
        ),
      );

      const trackIds = playlist.tracks?.filter((pt) => pt.track?.id).map((pt) => pt.track!.id) ?? [];
      await addTracksToQueue.mutateAsync(trackIds);

      if (playlist.tracks?.[0]?.track) {
        setCurrentTrack(playlist.tracks[0].track);
        actions.play(playlist.tracks[0].track.id || '');
      }
      toast.success(`Queue replaced with "${playlist.name}"`);
    } catch (error) {
      console.error('Failed to set playlist as queue:', error);
      toast.error('Could not replace the queue. Please try again.');
    } finally {
      setIsSettingAsQueue(false);
      setIsReplaceQueueDialogOpen(false);
    }
  }, [playlist, currentQueue, removeTrackFromQueue, addTracksToQueue, setCurrentTrack, actions]);

  // If the queue is empty there's nothing to lose — skip the confirmation.
  const handleSetAsQueue = useCallback(() => {
    if (currentQueue.length === 0) {
      void replaceQueueWithPlaylist();
    } else {
      setIsReplaceQueueDialogOpen(true);
    }
  }, [currentQueue.length, replaceQueueWithPlaylist]);

  const handleUpdateSorting = useCallback(
    async (value: string) => {
      if (!playlist) return;
      const [sortingKey, sortingDirection] = value.split(':') as [
        'position' | 'addedAt',
        'asc' | 'desc',
      ];
      try {
        await updatePlaylistSortingMutation.mutateAsync({
          playlistId: playlist.id,
          input: { sortingKey, sortingDirection },
        });
        refetch();
      } catch (error) {
        console.error('Failed to update playlist sorting:', error);
        toast.error('Could not change the sort order. Please try again.');
      }
    },
    [playlist, updatePlaylistSortingMutation, refetch],
  );

  const currentSortingKey = playlist?.sorting?.sortingKey === 'addedAt' ? 'addedAt' : 'position';
  const currentSortingDirection =
    playlist?.sorting?.sortingDirection === 'desc' ? 'desc' : 'asc';
  const currentSortValue = `${currentSortingKey}:${currentSortingDirection}`;

  const queueCount = currentQueue.length;
  const sortDisabled = loading || updatePlaylistSortingMutation.isPending || !playlist;

  return (
    <div className="p-4 lg:p-6 space-y-8 flex flex-col z-0">
      {/* Header — row 1: identity + primary action */}
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0 mt-0.5">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Button>
          <PlaylistTitle playlist={playlist} isLoading={loading} />
          <Button
            size="sm"
            onClick={() => setIsAddTrackDrawerOpen(true)}
            disabled={!playlist}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add tracks
          </Button>
        </div>

        {/* Header — row 2: stats + secondary controls */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <PlaylistMetadata playlist={playlist || undefined} isLoading={loading} />

          <div className="flex items-center gap-2">
            <PlaylistDetailActions
              playlist={playlist || undefined}
              isLoading={loading}
              isDeleting={isDeleting}
              isSettingAsQueue={isSettingAsQueue}
              onDelete={() => setIsDeleteDialogOpen(true)}
              onSetAsQueue={handleSetAsQueue}
              onAddTrack={() => setIsAddTrackDrawerOpen(true)}
              onDownloadAllHq={() => setIsHqBatchDownloadDialogOpen(true)}
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
                <Button size="sm" variant="ghost" disabled={sortDisabled}>
                  <ArrowUpDown className="h-4 w-4" aria-hidden />
                  Sort
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Sort tracks by</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={currentSortValue}
                  onValueChange={handleUpdateSorting}
                >
                  <DropdownMenuRadioItem
                    value="position:asc"
                    disabled={updatePlaylistSortingMutation.isPending}
                  >
                    Manual order
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="position:desc"
                    disabled={updatePlaylistSortingMutation.isPending}
                  >
                    Manual order, reversed
                  </DropdownMenuRadioItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioItem
                    value="addedAt:desc"
                    disabled={updatePlaylistSortingMutation.isPending}
                  >
                    Recently added
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="addedAt:asc"
                    disabled={updatePlaylistSortingMutation.isPending}
                  >
                    Oldest added
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Tempo arc across the set */}
      <PlaylistDetailChart tracks={playlist?.tracks || []} isLoading={loading} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tracks">
            <Disc3 className="h-4 w-4" aria-hidden />
            Tracks
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            <Sparkles className="h-4 w-4" aria-hidden />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="discovery">
            <Compass className="h-4 w-4" aria-hidden />
            Discovery
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
            onTrackAdded={refetch}
            recommendations={recommendations}
          />
        </TabsContent>

        <TabsContent value="discovery" className="space-y-4">
          <PlaylistDiscovery playlistId={playlist?.id || ''} />
        </TabsContent>
      </Tabs>

      <AddTrackDrawer
        open={isAddTrackDrawerOpen}
        onOpenChange={setIsAddTrackDrawerOpen}
        addTrackToPlaylist={addTrackToPlaylist}
        playlistId={id}
      />

      <PlaylistHqBatchDownloadDialog
        playlist={playlist || undefined}
        open={isHqBatchDownloadDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsHqBatchDownloadDialogOpen(nextOpen);
          if (!nextOpen) {
            refetch();
          }
        }}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this playlist?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{playlist?.name}</span> will be
              permanently removed. Your tracks stay in your library — only the playlist is
              deleted. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Keep playlist</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting…' : 'Delete playlist'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isReplaceQueueDialogOpen} onOpenChange={setIsReplaceQueueDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your current queue?</AlertDialogTitle>
            <AlertDialogDescription>
              Your queue has {queueCount} {queueCount === 1 ? 'track' : 'tracks'} in it. Loading
              this playlist will clear it and start from the top.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSettingAsQueue}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void replaceQueueWithPlaylist();
              }}
              disabled={isSettingAsQueue}
            >
              {isSettingAsQueue ? 'Replacing…' : 'Replace queue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
