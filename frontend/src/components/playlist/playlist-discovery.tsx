import { capitalizeEveryWord, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { type DiscoveredTrack, useDiscoverSimilarTracksForPlaylist } from '@/services/playlist-hooks';
import { Compass, ExternalLink, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface PlaylistDiscoveryProps {
  playlistId: string;
}

const HOVER_PREVIEW_DELAY_MS = 100;

function DiscoveredVideoCard({ track }: { track: DiscoveredTrack }) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    if (!track.videoId) return;
    clearHoverTimeout();
    hoverTimeoutRef.current = setTimeout(() => setIsPreviewing(true), HOVER_PREVIEW_DELAY_MS);
  };

  const handleMouseLeave = () => {
    clearHoverTimeout();
    setIsPreviewing(false);
  };

  useEffect(() => clearHoverTimeout, []);

  return (
    <div className="w-full">
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'group relative block aspect-video w-full overflow-hidden rounded-xl bg-muted',
          !track.videoId && 'opacity-60',
        )}
      >
        {isPreviewing && track.videoId ? (
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${track.videoId}?autoplay=1`}
            title={`${track.artist} - ${track.title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            {track.videoId ? (
              <img
                src={`https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`}
                alt={`${track.artist} - ${track.title}`}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                No video match
              </div>
            )}
            {track.videoId && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
                  <Play className="h-5 w-5 fill-white text-white" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">
            {capitalizeEveryWord(track.title)}
          </p>
          <p className="truncate text-xs text-muted-foreground">{capitalizeEveryWord(track.artist)}</p>
        </div>
        {track.externalLink && (
          <a
            href={track.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            title="View source"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function DiscoveredVideoCardSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="aspect-video w-full rounded-xl bg-muted" />
      <div className="mt-2 space-y-1.5">
        <div className="h-3.5 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );
}

function DiscoveryGroupSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <DiscoveredVideoCardSkeleton key={`group-skeleton-${i}`} />
        ))}
      </div>
    </div>
  );
}

export function PlaylistDiscovery({ playlistId }: PlaylistDiscoveryProps) {
  const { tracks, isLoading, error, discover } = useDiscoverSimilarTracksForPlaylist(playlistId);

  const groups = useMemo(() => {
    const bySourceArtist = new Map<string, DiscoveredTrack[]>();
    for (const track of tracks) {
      const list = bySourceArtist.get(track.sourceArtist) ?? [];
      list.push(track);
      bySourceArtist.set(track.sourceArtist, list);
    }
    return Array.from(bySourceArtist.entries());
  }, [tracks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Find tracks outside your library, based on artists similar to this playlist's.
        </p>
        <Button size="sm" onClick={() => discover()} disabled={isLoading || !playlistId}>
          <Compass className="h-4 w-4 mr-2" />
          {isLoading ? 'Discovering…' : tracks.length > 0 ? 'Refresh' : 'Discover'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">Failed to discover tracks: {error}</p>}

      {isLoading && (
        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <DiscoveryGroupSkeleton key={`discovery-group-skeleton-${i}`} />
          ))}
        </div>
      )}

      {!isLoading && groups.length > 0 && (
        <div className="space-y-8">
          {groups.map(([sourceArtist, groupTracks]) => (
            <div key={sourceArtist} className="space-y-3">
              <h3 className="text-sm font-semibold">
                Similar to {capitalizeEveryWord(sourceArtist)}
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {groupTracks.map((track) => (
                  <DiscoveredVideoCard key={`${track.artist}::${track.title}`} track={track} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && tracks.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Click "Discover" to find tracks outside your library, similar to this playlist's artists.
        </p>
      )}
    </div>
  );
}
