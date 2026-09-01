import { Track } from '@/__generated__/types';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { apiUrl } from '@/lib/api-config';
import { capitalizeEveryWord, cn } from '@/lib/utils';
import { Heart, Music, Pause, Play } from 'lucide-react';
import { memo, useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { AudioQualityBadge } from './audio-quality-badge';
import { GenresBadge } from './genres-badge';
import { findCamelotKey } from './track-feature-options';
import { TrackMoreMenu } from './track-more-menu';

interface TrackTileProps {
  track: Track;
  className?: string;
}

/**
 * The default library object: cover art leads, chrome recedes. A roughly-square
 * artwork panel with a compact info strip carrying the values a DJ sorts on
 * live — BPM, key, energy. See DESIGN.md, "The Crate Room".
 */
export const TrackTile = memo(function TrackTile({ track, className }: TrackTileProps) {
  const actions = useAudioPlayerActions();
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const isPlaying = useIsPlaying();
  const [imageFailed, setImageFailed] = useState(false);

  const isCurrent = currentTrack?.id === track.id;
  const isThisPlaying = isCurrent && isPlaying;

  const title = capitalizeEveryWord(track.title || 'Unknown title');
  const artist = capitalizeEveryWord(track.artist || 'Unknown artist');
  const genres = track.genres?.length ? track.genres : [];
  const camelot = findCamelotKey(track.mfKey ?? undefined);
  const bpm = track.mfTempo != null && track.mfTempo >= 0 ? Math.round(track.mfTempo) : null;
  const energy = track.mfArousalMood ?? null;

  const togglePlay = () => {
    if (!isCurrent) {
      setCurrentTrack(track);
      actions.play(track.id);
    } else if (isPlaying) {
      actions.pause(track.id);
    } else {
      actions.play(track.id);
    }
  };

  return (
    <div
      className={cn(
        'group/tile relative flex flex-col overflow-hidden rounded-lg bg-card shadow-sm',
        'focus-within:ring-1 focus-within:ring-ring',
        className,
      )}
    >
      {/* Artwork panel — the hero */}
      <div className="relative aspect-square w-full overflow-hidden rounded-t-lg bg-muted">
        {track.imagePath && !imageFailed ? (
          <img
            src={apiUrl(`/api/images/serve?imagePath=${track.imagePath}`)}
            alt={`${title} — ${artist}`}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music className="h-10 w-10 text-muted-foreground/50" aria-hidden />
          </div>
        )}

        {/* Play affordance — appears on hover / keyboard focus, always shown while this track plays */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-background/60',
            'opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-within/tile:opacity-100',
            isThisPlaying && 'opacity-100',
          )}
        >
          <Button
            size="icon"
            onClick={togglePlay}
            aria-label={isThisPlaying ? `Pause ${title}` : `Play ${title}`}
            className="h-11 w-11 rounded-full shadow-sm active:scale-95"
          >
            {isThisPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 translate-x-px" />
            )}
          </Button>
        </div>

        <div className="absolute top-2 right-2">
          <AudioQualityBadge format={track.format} hqAudioPath={track.hqAudioPath} />
        </div>
      </div>

      {/* Info strip */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate font-semibold leading-none capitalize" title={title}>
            {title}
          </p>
          <p className="mt-1 truncate text-muted-foreground text-sm capitalize" title={artist}>
            {artist}
          </p>
        </div>

        {(bpm != null || camelot || energy) && (
          <div className="flex flex-wrap items-center gap-1">
            {bpm != null && (
              <Badge variant="outline" size="xs" className="font-mono">
                {bpm} BPM
              </Badge>
            )}
            {camelot && (
              <Badge variant="outline" size="xs" className="font-mono">
                {camelot.label}
              </Badge>
            )}
            {energy && (
              <Badge variant="outline" size="xs" className="capitalize">
                {energy}
              </Badge>
            )}
          </div>
        )}

        {genres.length > 0 && <GenresBadge genres={genres} variant="secondary" />}

        <div className="mt-auto flex items-center justify-between pt-1">
          <FavoriteButton track={track} />
          <TrackMoreMenu
            trackId={track.id}
            artist={track.artist || ''}
            title={track.title || ''}
            format={track.format}
            hqAudioPath={track.hqAudioPath}
          />
        </div>
      </div>
    </div>
  );
});

function FavoriteButton({ track }: { track: Track }) {
  const actions = useAudioPlayerActions();
  const [isFavorite, setIsFavorite] = useState(track.isFavorite);

  const toggle = () => {
    setIsFavorite((prev) => !prev);
    void actions.toggleFavorite(track.id);
  };

  return (
    <Button
      variant="ghost"
      size="iconSm"
      onClick={toggle}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart className={cn('h-4 w-4', isFavorite && 'fill-red-500 text-red-500')} />
    </Button>
  );
}
