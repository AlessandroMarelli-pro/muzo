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
  Compass,
  Disc3,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
// Note: This app uses custom view state instead of routing
// The id should be passed as a prop from the parent component
import { Playlist } from '@/__generated__/types';
import { useAudioPlayerActions, useCurrentTrack } from '@/contexts/audio-player-context';
import { formatCoarseDuration } from '@/lib/utils';
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
import { PlaylistTracksList, type PlaylistTracksListHandle } from './playlist-tracks-list';
import { TrackRecommendations } from './track-recommendations';

interface PlaylistDetailProps {
  id: string;
  onBack: () => void;
}
/**
 * The set-sheet masthead — playlist name, a stamped meta line, description.
 * Reads like the top of a hand-written cue sheet.
 */
const SetSheetMasthead = ({
  playlist,
  isLoading,
}: {
  playlist: Playlist | undefined;
  isLoading: boolean;
}) => {
  const stats = playlist?.stats;
  const meta = [
    stats?.numberOfTracks != null && `${stats.numberOfTracks} tracks`,
    stats?.totalDuration ? formatCoarseDuration(stats.totalDuration) : null,
    stats?.bpmRange?.min != null && stats?.bpmRange?.max != null
      ? `${stats.bpmRange.min}–${stats.bpmRange.max} BPM`
      : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <div className="min-w-0 flex-1">
      <h1 className="truncate text-2xl font-bold leading-tight">
        {isLoading ? <Skeleton className="h-7 w-48" /> : playlist?.name}
      </h1>
      {isLoading ? (
        <Skeleton className="mt-1.5 h-4 w-64" />
      ) : (
        <p className="mt-1 truncate font-mono text-xs uppercase text-muted-foreground [letter-spacing:0.04em]">
          {meta}
          {playlist?.description ? `  —  ${playlist.description}` : ''}
        </p>
      )}
    </div>
  );
};
export function PlaylistDetail({ id, onBack }: PlaylistDetailProps) {
  const { playlist, recommendations } = Route.useLoaderData();
  const router = useRouter();
  const loading = false;
  const { setCurrentTrack, currentTrack } = useCurrentTrack();
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

  const tracksListRef = useRef<PlaylistTracksListHandle>(null);

  const refetch = useCallback(() => {
    router.invalidate();
  }, [router]);

  const seekToPosition = useCallback((position: number) => {
    setActiveTab('tracks');
    requestAnimationFrame(() => tracksListRef.current?.scrollToPosition(position));
  }, []);

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
  const tracks = useMemo(() => playlist?.tracks ?? [], [playlist?.tracks]);
  const currentPosition = useMemo(
    () => tracks.find((t) => t.track?.id === currentTrack?.id)?.position,
    [tracks, currentTrack?.id],
  );

  return (
    <div className="z-0 flex flex-col gap-6 p-4 lg:p-6">
      {/* Set-sheet masthead */}
      <div className="space-y-3 border-b pb-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="mt-0.5 shrink-0">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Button>
          <SetSheetMasthead playlist={playlist || undefined} isLoading={loading} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            onClick={() => setIsAddTrackDrawerOpen(true)}
            disabled={!playlist}
            className="mr-auto shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add tracks
          </Button>
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

      {/* Tempo sketch — the set's arc in the margin */}
      <PlaylistDetailChart
        tracks={tracks}
        isLoading={loading}
        currentPosition={currentPosition}
        onSeekToPosition={seekToPosition}
      />

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
            handleRef={tracksListRef}
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
