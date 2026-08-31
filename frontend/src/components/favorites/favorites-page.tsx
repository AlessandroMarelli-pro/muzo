import type { Playlist, Track, TrackRecommendation } from '@/__generated__/types';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { NoData } from '@/components/no-data';
import { TrackRecommendations } from '@/components/playlist/track-recommendations';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { useRemoveTrackFromPlaylist } from '@/services/playlist-hooks';
import { Heart, ListMusic, Sparkles } from 'lucide-react';
import * as React from 'react';
import type { FavoriteTrack } from './favorites-columns';
import { FavoritesTable } from './favorites-table';

export type FavoritesTab = 'tracks' | 'recommendations';

interface FavoritesPageProps {
  playlist: Playlist;
  recommendations: TrackRecommendation[];
  tab: FavoritesTab;
  onTabChange: (tab: FavoritesTab) => void;
}

const matchesSearch = (track: FavoriteTrack, query: string) => {
  if (!query) return true;

  const needle = query.trim().toLowerCase();
  const haystack = [
    track.title,
    track.artist,
    ...((track.genres as string[]) ?? []),
    ...((track.subgenres as string[]) ?? []),
  ];

  return haystack.some((value) => value?.toLowerCase().includes(needle));
};

export function FavoritesPage({ playlist, recommendations, tab, onTabChange }: FavoritesPageProps) {
  const [search, setSearch] = React.useState('');

  const actions = useAudioPlayerActions();
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const isPlaying = useIsPlaying();
  const removeMutation = useRemoveTrackFromPlaylist();

  // Flatten the playlist join rows so the table works over plain tracks while
  // keeping `addedAt` available as a column.
  const tracks = React.useMemo<FavoriteTrack[]>(
    () =>
      (playlist?.tracks ?? []).flatMap((playlistTrack) =>
        playlistTrack.track ? [{ ...playlistTrack.track, addedAt: playlistTrack.addedAt }] : [],
      ),
    [playlist?.tracks],
  );

  const filteredTracks = React.useMemo(
    () => tracks.filter((track) => matchesSearch(track, search)),
    [tracks, search],
  );

  const handleTogglePlay = React.useCallback(
    (track: Track) => {
      if (currentTrack?.id !== track.id) {
        setCurrentTrack(track);
        actions.play(track.id);
        return;
      }
      if (isPlaying) {
        actions.pause(track.id);
      } else {
        actions.play(track.id);
      }
    },
    [actions, currentTrack, isPlaying, setCurrentTrack],
  );

  const handleRemove = React.useCallback(
    (track: Track) => {
      void removeMutation.mutateAsync({
        playlistId: playlist.id,
        trackId: track.id,
        artist: track.artist || '',
        title: track.title || '',
      });
    },
    [removeMutation, playlist.id],
  );

  const handleBulkRemove = React.useCallback(
    (selected: Track[]) => {
      void (async () => {
        const CHUNK = 5;
        for (let index = 0; index < selected.length; index += CHUNK) {
          const chunk = selected.slice(index, index + CHUNK);
          await Promise.allSettled(
            chunk.map((track) =>
              removeMutation.mutateAsync({
                playlistId: playlist.id,
                trackId: track.id,
                artist: track.artist || '',
                title: track.title || '',
              }),
            ),
          );
        }
      })();
    },
    [removeMutation, playlist.id],
  );

  const handleAddToFavorites = React.useCallback(
    (trackId?: string) => {
      if (trackId) actions.toggleFavorite(trackId);
    },
    [actions],
  );

  const hasFavorites = tracks.length > 0;

  return (
    <PageShell>
      <PageHeader title="Favorites" description={`${tracks.length} tracks you've loved.`}>
        {hasFavorites && (
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search favorites…"
            className="sm:w-72"
          />
        )}
      </PageHeader>

      <Tabs value={tab} onValueChange={(value) => onTabChange(value as FavoritesTab)}>
        <TabsList>
          <TabsTrigger value="tracks">
            <ListMusic className="h-4 w-4" aria-hidden />
            Tracks
            <Badge variant="secondary" size="xs">
              {tracks.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            <Sparkles className="h-4 w-4" aria-hidden />
            Recommendations
            <Badge variant="secondary" size="xs">
              {recommendations.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tracks" className="space-y-4">
          {!hasFavorites ? (
            <NoData
              Icon={Heart}
              title="No favorites yet"
              subtitle="Like tracks from Music or Swipe and they'll collect here."
            />
          ) : filteredTracks.length === 0 ? (
            <NoData
              Icon={Heart}
              title="No matches"
              subtitle={`No favorites match "${search}".`}
              buttonAction={() => setSearch('')}
              buttonLabel="Clear search"
            />
          ) : (
            <FavoritesTable
              data={filteredTracks}
              onTogglePlay={handleTogglePlay}
              onRemove={handleRemove}
              onBulkRemove={handleBulkRemove}
              currentTrackId={currentTrack?.id}
              isPlaying={isPlaying}
              isRemoving={removeMutation.isPending}
            />
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <TrackRecommendations
            playlistId={playlist?.id ?? ''}
            onTrackAdded={handleAddToFavorites}
            recommendations={recommendations}
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
