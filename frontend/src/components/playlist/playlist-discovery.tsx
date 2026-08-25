import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { capitalizeEveryWord } from '@/lib/utils';
import { type DiscoveredTrack, useDiscoverSimilarTracksForPlaylist } from '@/services/playlist-hooks';
import { Compass, ExternalLink, Youtube } from 'lucide-react';

interface PlaylistDiscoveryProps {
  playlistId: string;
}

const confidenceVariant = (confidence: string): 'default' | 'secondary' | 'outline' => {
  if (confidence === 'exact') return 'default';
  if (confidence === 'fuzzy') return 'secondary';
  return 'outline';
};

function DiscoveredTrackRow({ track }: { track: DiscoveredTrack }) {
  const youtubeUrl = track.videoId ? `https://www.youtube.com/watch?v=${track.videoId}` : null;

  return (
    <div className="flex items-center justify-between gap-4 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {capitalizeEveryWord(track.artist)} — {capitalizeEveryWord(track.title)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          Similar to {capitalizeEveryWord(track.sourceArtist)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={confidenceVariant(track.confidence)} className="text-xs">
          {track.confidence}
        </Badge>
        {track.externalLink && (
          <a
            href={track.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            title="View source"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {youtubeUrl ? (
          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <Youtube className="h-4 w-4 mr-2" />
              Play
            </Button>
          </a>
        ) : (
          <Button size="sm" variant="outline" disabled>
            <Youtube className="h-4 w-4 mr-2" />
            No match
          </Button>
        )}
      </div>
    </div>
  );
}

function DiscoveredTrackRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 p-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

export function PlaylistDiscovery({ playlistId }: PlaylistDiscoveryProps) {
  const { tracks, isLoading, error, discover } = useDiscoverSimilarTracksForPlaylist(playlistId);

  return (
    <div className="space-y-4">
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
        <Card className="py-0">
          <CardContent className="p-0">
            <div className="divide-y">
              {Array.from({ length: 6 }).map((_, i) => (
                <DiscoveredTrackRowSkeleton key={`discovery-skeleton-${i}`} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && tracks.length > 0 && (
        <Card className="py-0">
          <CardContent className="p-0">
            <div className="divide-y">
              {tracks.map((track) => (
                <DiscoveredTrackRow key={`${track.artist}::${track.title}`} track={track} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && tracks.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Click "Discover" to find tracks outside your library, similar to this playlist's artists.
        </p>
      )}
    </div>
  );
}
