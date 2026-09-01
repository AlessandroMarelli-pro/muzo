import { PlaylistTrack, Track } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { capitalizeEveryWord, cn, formatDuration } from '@/lib/utils';
import { useAddTrackToQueue } from '@/services/queue-hooks';
import { Link } from '@tanstack/react-router';
import { AudioLines, Brain, GripVertical, ListMusic, Pause, Play, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { AudioQualityBadge } from '../track/audio-quality-badge';
import { GenresBadge } from '../track/genres-badge';
import { Skeleton } from '../ui/skeleton';
import { apiUrl } from '@/lib/api-config';

/** Album-art URL, or null when the track has no artwork (avoids a broken request). */
const albumArtUrl = (imagePath?: string | null) =>
  imagePath ? apiUrl(`/api/images/serve?imagePath=${encodeURIComponent(imagePath)}`) : null;

const trackLabel = (track?: Track | null) => {
  const artist = track?.artist ? capitalizeEveryWord(track.artist) : 'Unknown artist';
  const title = track?.title ? capitalizeEveryWord(track.title) : 'Unknown title';
  return `${artist} — ${title}`;
};
export const PlaylistTrackListCardSkeleton = ({ position }: { position: number }) => {
  return (
    <div className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors group h-20">
      <div className="flex items-center gap-2 text-muted-foreground text-sm w-8 ">
        <GripVertical className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span>{position}</span>
      </div>
      <Skeleton className="min-w-10 min-h-10 w-10 h-10 rounded-md" />
      <Skeleton className="w-full h-6" />
      <Skeleton className="w-full h-6" />
    </div>
  );
};

export const PlaylistTrackListCard = memo(
  ({
    playlistTrack,
    handleRemoveTrack,
    removingTrackId: _removingTrackId,
    dragHandleProps,
    index,
    playlistLength,
  }: {
    playlistTrack: PlaylistTrack;
    handleRemoveTrack: (trackId: string) => void;
    removingTrackId: string | null;
    dragHandleProps?: any;
    index: number;
    playlistLength: number;
  }) => {
    const { currentTrack, setCurrentTrack } = useCurrentTrack();
    const actions = useAudioPlayerActions();
    const isPlaying = useIsPlaying();
    const addToQueueMutation = useAddTrackToQueue();
    // Only check if this specific track is the current track and playing
    const isCurrentTrack = currentTrack?.id === playlistTrack.track?.id;
    const isThisTrackPlaying = isCurrentTrack && isPlaying;

    const artUrl = albumArtUrl(playlistTrack.track?.imagePath);
    const label = trackLabel(playlistTrack.track);
    const tempo = playlistTrack.track?.mfTempo;
    const handlePlay = (e: React.SyntheticEvent<any>) => {
      e.stopPropagation();
      if (currentTrack?.id !== playlistTrack.track?.id) {
        setCurrentTrack(playlistTrack.track as Track);
        actions.play(playlistTrack.track?.id || '');
      } else {
        // Same track - toggle play/pause
        if (isThisTrackPlaying) {
          actions.pause(playlistTrack.track?.id || '');
        } else {
          actions.play(playlistTrack.track?.id || '');
        }
      }
    };
    return (
      <div
        key={playlistTrack.id}
        aria-current={isCurrentTrack ? 'true' : undefined}
        className={cn(
          'flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors group',
          isCurrentTrack && 'bg-muted/80 border-l-2 border-l-primary',
          isCurrentTrack && index === 0 && 'rounded-t-xl',
          isCurrentTrack && index === playlistLength - 1 && 'rounded-b-xl',
        )}
      >
        {/* Position / drag handle */}
        <div className="flex items-center gap-2 text-muted-foreground text-sm w-8">
          {dragHandleProps ? (
            <button
              type="button"
              {...dragHandleProps}
              aria-label={`Reorder ${label}`}
              className="rounded-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-opacity cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <GripVertical
              className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden
            />
          )}
          <span className="tabular-nums">{playlistTrack.position}</span>
        </div>
        {artUrl ? (
          <img
            src={artUrl}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            className="w-10 h-10 object-cover rounded-md shrink-0"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-md shrink-0 bg-muted flex items-center justify-center"
            aria-hidden
          >
            <ListMusic className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        {/* Track Info */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isThisTrackPlaying && (
            <AudioLines className="h-4 w-4 shrink-0 text-primary" aria-label="Now playing" />
          )}
          <span className="text-sm font-medium truncate">{label}</span>
          <AudioQualityBadge
            format={playlistTrack.track?.format}
            hqAudioPath={playlistTrack.track?.hqAudioPath}
          />
        </div>

        {/* Genre */}
        <div className="hidden md:flex flex-row gap-2">
          <GenresBadge genres={playlistTrack.track?.genres || []} variant="secondary" />
        </div>
        <div className="hidden md:flex flex-row gap-2">
          <GenresBadge genres={playlistTrack.track?.subgenres || []} variant="outline" />
        </div>
        <div className="hidden md:block text-xs text-muted-foreground font-mono tabular-nums">
          {tempo ? `${Math.round(tempo)} BPM` : '— BPM'}
        </div>
        {/* Duration */}
        <div className="text-sm text-muted-foreground font-mono tabular-nums">
          {formatDuration(playlistTrack.track?.duration || 0) || '—'}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePlay}
            aria-label={isThisTrackPlaying ? `Pause ${label}` : `Play ${label}`}
          >
            {isThisTrackPlaying ? (
              <Pause className="h-5 w-5" aria-hidden />
            ) : (
              <Play className="h-5 w-5 ml-0.5" aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              addToQueueMutation.mutate(playlistTrack.track?.id || '');
            }}
            aria-label={`Add ${label} to queue`}
          >
            <ListMusic className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => handleRemoveTrack(playlistTrack.track?.id || '')}
            aria-label={`Remove ${label} from playlist`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/research/{-$trackId}"
              params={{ trackId: playlistTrack.track?.id ?? '' }}
              preload="intent"
              aria-label={`Open research for ${label}`}
            >
              <Brain className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    );
  },
);
PlaylistTrackListCard.displayName = 'PlaylistTrackListCard';
