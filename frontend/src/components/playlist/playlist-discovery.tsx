import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiUrl } from '@/lib/api-config';
import { capitalizeEveryWord, cn, formatSimilarity } from '@/lib/utils';
import { type DiscoveredTrack, useDiscoverSimilarTracksForPlaylist } from '@/services/playlist-hooks';
import { Compass, ExternalLink, ListMusic, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NoData } from '../no-data';

interface PlaylistDiscoveryProps {
  playlistId: string;
}

const HOVER_PREVIEW_DELAY_MS = 100;

/** Mirrors REC_GRID in track-recommendations-card.tsx so Discovery reads as
 * the same ledger, not a second layout language. */
const DISCOVERY_GRID =
  'grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 border-l-2 border-l-transparent pl-3 pr-3';

function DiscoveredTrackRow({ track }: { track: DiscoveredTrack }) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const startPreview = () => {
    if (!track.videoId) return;
    clearHoverTimeout();
    hoverTimeoutRef.current = setTimeout(() => setIsPreviewing(true), HOVER_PREVIEW_DELAY_MS);
  };

  const stopPreview = () => {
    clearHoverTimeout();
    setIsPreviewing(false);
  };

  useEffect(() => clearHoverTimeout, []);

  const artist = capitalizeEveryWord(track.artist);
  const title = capitalizeEveryWord(track.title);
  const label = `${artist} — ${title}`;

  return (
    <div
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
      className="group border-b transition-colors last:border-b-0 hover:bg-muted/50"
    >
      <div className={cn(DISCOVERY_GRID, 'py-2')}>
        <button
          type="button"
          tabIndex={track.videoId ? 0 : -1}
          aria-label={track.videoId ? `Preview ${label}` : undefined}
          disabled={!track.videoId}
          className={cn(
            'relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            !track.videoId && 'opacity-60',
          )}
        >
          {track.videoId ? (
            <>
              <img
                src={`https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40 group-focus-within:bg-black/40">
                <Play className="h-3.5 w-3.5 fill-white text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
              </div>
            </>
          ) : (
            <span className="sr-only">No video match</span>
          )}
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span className="truncate">{artist}</span>
            <span className="shrink-0 text-border">·</span>
            <span className="shrink-0 italic">{formatSimilarity(track.matchScore)} match</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1">
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {formatSimilarity(track.matchScore)}
          </Badge>
          {track.externalLink && (
            <a
              href={track.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`View source for ${label}`}
              title="View source"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {isPreviewing && track.videoId && (
        <div className="mx-3 mb-3 aspect-video max-w-md overflow-hidden rounded-xl bg-black">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${track.videoId}?autoplay=1`}
            title={label}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

function DiscoveredTrackRowSkeleton() {
  return (
    <div className={cn(DISCOVERY_GRID, 'py-2.5')}>
      <Skeleton className="h-9 w-9 rounded" />
      <div className="min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-12 justify-self-end" />
    </div>
  );
}

function DiscoveryGroupSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="divide-y rounded-xl border">
        {Array.from({ length: 4 }).map((_, i) => (
          <DiscoveredTrackRowSkeleton key={`group-skeleton-${i}`} />
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

  const groupArtUrl = (imagePath?: string | null) =>
    imagePath ? apiUrl(`/api/images/serve?imagePath=${encodeURIComponent(imagePath)}`) : null;

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

      {error && (
        <NoData
          Icon={ExternalLink}
          title="Couldn't discover tracks"
          subtitle={error}
          buttonAction={() => discover()}
          buttonLabel="Try again"
        />
      )}

      {isLoading && (
        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <DiscoveryGroupSkeleton key={`discovery-group-skeleton-${i}`} />
          ))}
        </div>
      )}

      {!isLoading && groups.length > 0 && (
        <div className="space-y-8">
          {groups.map(([sourceArtist, groupTracks]) => {
            const seedArtUrl = groupArtUrl(groupTracks[0]?.sourceImagePath);
            const seedTitle = groupTracks[0]?.sourceTitle;
            return (
            <div key={sourceArtist} className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                {seedArtUrl ? (
                  <img
                    src={seedArtUrl}
                    alt=""
                    loading="lazy"
                    className="h-9 w-9 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted"
                    aria-hidden
                  >
                    <ListMusic className="h-4 w-4 text-muted-foreground" />
                  </span>
                )}
                <span>
                  Similar to {capitalizeEveryWord(sourceArtist)}
                  {seedTitle ? ` — ${capitalizeEveryWord(seedTitle)}` : ''}
                </span>
              </h3>
              <div className="divide-y rounded-xl border">
                {groupTracks.map((track) => (
                  <DiscoveredTrackRow key={`${track.artist}::${track.title}`} track={track} />
                ))}
              </div>
            </div>
            );
          })}
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
