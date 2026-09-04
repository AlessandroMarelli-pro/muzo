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
  usePlaylist,
  useUpdatePlaylistSorting,
} from '@/services/playlist-hooks';
import { ArrowUpDown, ChevronDown, Compass, Disc3, Plus, Sparkles } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
// Note: This app uses custom view state instead of routing
// The id should be passed as a prop from the parent component
import { Playlist } from '@/__generated__/types';
import { useCurrentTrack } from '@/contexts/audio-player-context';
import { formatCoarseDuration } from '@/lib/utils';
import { Route } from '@/routes/playlists.$playlistId';
import { useRouter } from '@tanstack/react-router';
import { Skeleton } from '../ui/skeleton';
import { AddTrackDrawer } from './add-track-drawer';
import { PlaylistDetailActions } from './playlist-detail-actions';
import { PlaylistDetailChart } from './playlist-detail-chart';
import { PlaylistDetailThirdParties } from './playlist-detail-third-parties';
import { PlaylistDiscovery } from './playlist-discovery';
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
      <h1 className="truncate text-2xl font-bold leading-tight" title={playlist?.name ?? undefined}>
        {isLoading ? <Skeleton className="h-7 w-48" /> : playlist?.name}
      </h1>
      {isLoading ? (
        <Skeleton className="mt-1.5 h-4 w-64" />
      ) : (
        <>
          <p className="mt-1 truncate font-mono text-xs uppercase text-muted-foreground [letter-spacing:0.04em]">
            {meta}
          </p>
          {playlist?.description ? (
            <p className="mt-1 truncate text-sm text-muted-foreground" title={playlist.description}>
              {playlist.description}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};
const SORT_LABELS: Record<string, string> = {
  'position:asc': 'Manual order',
  'position:desc': 'Manual order, reversed',
  'addedAt:desc': 'Recently added',
  'addedAt:asc': 'Oldest added',
};

/** Sort control for the tracks list — scoped to the list it reorders, not the playlist. */
const TracksSortMenu = ({
  value,
  onChange,
  disabled,
  isPending,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  isPending: boolean;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size="sm" variant="ghost" disabled={disabled}>
        <ArrowUpDown className="h-4 w-4" aria-hidden />
        <span className="text-muted-foreground">Sort:</span>
        {SORT_LABELS[value] ?? 'Manual order'}
        <ChevronDown className="h-4 w-4" aria-hidden />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>Sort tracks by</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
        <DropdownMenuRadioItem value="position:asc" disabled={isPending}>
          Manual order
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="position:desc" disabled={isPending}>
          Manual order, reversed
        </DropdownMenuRadioItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioItem value="addedAt:desc" disabled={isPending}>
          Recently added
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="addedAt:asc" disabled={isPending}>
          Oldest added
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

export function PlaylistDetail({ id, onBack }: PlaylistDetailProps) {
  const { playlist, recommendations } = Route.useLoaderData();
  const router = useRouter();
  const loading = false;
  const { currentTrack } = useCurrentTrack();
  const [activeTab, setActiveTab] = useState('tracks');
  const [isAddTrackDrawerOpen, setIsAddTrackDrawerOpen] = useState(false);
  const { syncToYouTube, syncToTidal, syncToSpotify } = usePlaylist(id, 'default');
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
  const currentSortingDirection = playlist?.sorting?.sortingDirection === 'desc' ? 'desc' : 'asc';
  const currentSortValue = `${currentSortingKey}:${currentSortingDirection}`;

  const sortDisabled = loading || updatePlaylistSortingMutation.isPending || !playlist;
  const tracks = useMemo(() => playlist?.tracks ?? [], [playlist?.tracks]);
  const currentPosition = useMemo(
    () => tracks.find((t) => t.track?.id === currentTrack?.id)?.position,
    [tracks, currentTrack?.id],
  );
  const existingTrackIds = useMemo(
    () => tracks.map((t) => t.track?.id).filter((tid): tid is string => Boolean(tid)),
    [tracks],
  );

  return (
    <div className="z-0 flex flex-col gap-6 p-4 lg:p-6">
      {/* Set-sheet masthead */}
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-x-4">
        <SetSheetMasthead playlist={playlist || undefined} isLoading={loading} />

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="default"
            onClick={() => setIsAddTrackDrawerOpen(true)}
            disabled={!playlist}
            variant="link"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add tracks
          </Button>
          <PlaylistDetailThirdParties
            playlist={playlist || undefined}
            isLoading={loading}
            onSyncToYouTube={syncToYouTube}
            onSyncToTidal={syncToTidal}
            onSyncToSpotify={syncToSpotify}
          />
          <PlaylistDetailActions
            playlist={playlist || undefined}
            isLoading={loading}
            onDeleted={onBack}
            onChanged={refetch}
          />
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
          <div className="flex justify-end">
            <TracksSortMenu
              value={currentSortValue}
              onChange={handleUpdateSorting}
              disabled={sortDisabled}
              isPending={updatePlaylistSortingMutation.isPending}
            />
          </div>
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
        playlistName={playlist?.name}
        existingTrackIds={existingTrackIds}
      />

    </div>
  );
}
