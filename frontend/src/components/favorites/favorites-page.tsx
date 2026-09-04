import type { Playlist, Track, TrackRecommendation } from '@/__generated__/types';
import { PageShell } from '@/components/layout/page-shell';
import { TrackRecommendations } from '@/components/playlist/track-recommendations';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { capitalizeEveryWord } from '@/lib/utils';
import { useRemoveTrackFromPlaylist } from '@/services/playlist-hooks';
import { ListMusic, Sparkles } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { FavoritesEmpty, FavoritesNoMatches } from './favorites-empty';
import { FavoritesLedger } from './favorites-ledger';
import { FavoritesMasthead } from './favorites-masthead';
import type { FavoriteTrack, FavoritesSortKey, SortDirection } from './favorites-types';

export type FavoritesTab = 'tracks' | 'recommendations';

interface FavoritesPageProps {
  playlist: Playlist;
  recommendations: TrackRecommendation[];
  tab: FavoritesTab;
  onTabChange: (tab: FavoritesTab) => void;
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border bg-muted px-1 font-mono text-xs text-muted-foreground">
    {children}
  </kbd>
);

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

const DEFAULT_DIRECTION: Record<FavoritesSortKey, SortDirection> = {
  addedAt: 'desc',
  title: 'asc',
  mfTempo: 'asc',
  mfKey: 'asc',
};

const compareTracks = (
  a: FavoriteTrack,
  b: FavoriteTrack,
  key: FavoritesSortKey,
  direction: SortDirection,
) => {
  const dir = direction === 'asc' ? 1 : -1;
  switch (key) {
    case 'title':
      return (a.title ?? '').localeCompare(b.title ?? '') * dir;
    case 'mfTempo':
      return ((a.mfTempo ?? 0) - (b.mfTempo ?? 0)) * dir;
    case 'mfKey':
      return (
        (a.mfCamelotKey || a.mfKey || '').localeCompare(b.mfCamelotKey || b.mfKey || '', undefined, {
          numeric: true,
        }) * dir
      );
    case 'addedAt': {
      const at = a.addedAt ? new Date(a.addedAt).getTime() : 0;
      const bt = b.addedAt ? new Date(b.addedAt).getTime() : 0;
      return (at - bt) * dir;
    }
    default:
      return 0;
  }
};

export function FavoritesPage({ playlist, recommendations, tab, onTabChange }: FavoritesPageProps) {
  const [search, setSearch] = React.useState('');
  const [sortKey, setSortKey] = React.useState<FavoritesSortKey>('addedAt');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');

  const actions = useAudioPlayerActions();
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const isPlaying = useIsPlaying();
  const removeMutation = useRemoveTrackFromPlaylist();

  // Flatten the playlist join rows so the ledger works over plain tracks while
  // keeping `addedAt` available as a column.
  const tracks = React.useMemo<FavoriteTrack[]>(
    () =>
      (playlist?.tracks ?? []).flatMap((playlistTrack) =>
        playlistTrack.track ? [{ ...playlistTrack.track, addedAt: playlistTrack.addedAt }] : [],
      ),
    [playlist?.tracks],
  );

  const visibleTracks = React.useMemo(() => {
    const filtered = tracks.filter((track) => matchesSearch(track, search));
    return [...filtered].sort((a, b) => compareTracks(a, b, sortKey, sortDirection));
  }, [tracks, search, sortKey, sortDirection]);

  const handleSortChange = React.useCallback((key: FavoritesSortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prevKey;
      }
      setSortDirection(DEFAULT_DIRECTION[key]);
      return key;
    });
  }, []);

  const handleTogglePlay = React.useCallback(
    (track: Track) => {
      if (currentTrack?.id !== track.id) {
        setCurrentTrack(track);
        actions.play(track.id);
        return;
      }
      if (isPlaying) actions.pause(track.id);
      else actions.play(track.id);
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
      toast.success('Removed from favorites', {
        description: capitalizeEveryWord(
          `${track.artist || 'Unknown artist'} — ${track.title || 'Unknown title'}`,
        ),
        action: {
          label: 'Undo',
          onClick: () => void actions.toggleFavorite(track.id),
        },
      });
    },
    [removeMutation, playlist.id, actions],
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
        toast.success(
          `Removed ${selected.length} ${selected.length === 1 ? 'track' : 'tracks'} from favorites`,
        );
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
      <FavoritesMasthead
        playlist={playlist}
        shownCount={visibleTracks.length}
        totalCount={tracks.length}
      />

      <Tabs value={tab} onValueChange={(value) => onTabChange(value as FavoritesTab)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="tracks">
              <ListMusic className="size-4" aria-hidden />
              Tracks
              <Badge variant="secondary" size="xs">
                {tracks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="recommendations">
              <Sparkles className="size-4" aria-hidden />
              Recommendations
              <Badge variant="secondary" size="xs">
                {recommendations.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {tab === 'tracks' && hasFavorites && (
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search favorites…"
              className="sm:w-72"
            />
          )}
        </div>

        <TabsContent value="tracks" className="space-y-4">
          {!hasFavorites ? (
            <FavoritesEmpty />
          ) : visibleTracks.length === 0 ? (
            <FavoritesNoMatches query={search} onClear={() => setSearch('')} />
          ) : (
            <FavoritesLedger
              data={visibleTracks}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
              onTogglePlay={handleTogglePlay}
              onRemove={handleRemove}
              onBulkRemove={handleBulkRemove}
              currentTrackId={currentTrack?.id}
              currentTrackKey={currentTrack?.mfCamelotKey || currentTrack?.mfKey}
              isPlaying={isPlaying}
              isRemoving={removeMutation.isPending}
            />
          )}
          {hasFavorites && visibleTracks.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-1 text-muted-foreground text-xs">
              <Kbd>J</Kbd>
              <Kbd>K</Kbd>
              <span>move</span>
              <span className="text-border">·</span>
              <Kbd>Space</Kbd>
              <span>play</span>
              <span className="text-border">·</span>
              <Kbd>X</Kbd>
              <span>unfavorite</span>
            </p>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-3">
          <p className="px-1 text-muted-foreground text-xs">
            Pulled from your library — closest to what you’ve already loved. Add one and it joins the
            shelf.
          </p>
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
