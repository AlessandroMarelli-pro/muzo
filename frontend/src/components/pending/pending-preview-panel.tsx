import type { Track } from '@/__generated__/types';
import { SwipeControls } from '@/components/swipe/swipe-controls';
import { AudioQualityBadge } from '@/components/track/audio-quality-badge';
import {
  arousalMoodOptions,
  danceabilityFeelingOptions,
  findFeatureLabel,
  formatKey,
  valenceMoodOptions,
} from '@/components/track/track-feature-options';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentTrack, useIsPlaying } from '@/contexts/audio-player-context';
import { apiUrl } from '@/lib/api-config';
import { cn, formatTime } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import { Brain, Music, Pause, Play } from 'lucide-react';
import type { RatingKind } from './pending-columns';

interface PendingPreviewPanelProps {
  track?: Track;
  isLoading?: boolean;
  isRating?: boolean;
  onRate: (trackId: string, kind: RatingKind) => void;
  onTogglePlay: (track: Track) => void;
  className?: string;
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-0.5">
    <p className="text-muted-foreground text-xs">{label}</p>
    <p className="font-medium font-mono text-sm">{value}</p>
  </div>
);

const FeatureBar = ({ label, value }: { label: string; value?: number | null }) => {
  if (typeof value !== 'number') return null;

  const percent = Math.round(value * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{percent}%</span>
      </div>
      <Progress value={percent} className="h-1.5" aria-label={`${label}: ${percent}%`} />
    </div>
  );
};

/**
 * Detail view for the row currently focused in the pending table. Rating
 * controls live here as well as in the row, so a considered listen and a fast
 * triage pass both have the actions within reach.
 */
export function PendingPreviewPanel({
  track,
  isLoading,
  isRating,
  onRate,
  onTogglePlay,
  className,
}: PendingPreviewPanelProps) {
  const { currentTrack } = useCurrentTrack();
  const isPlaying = useIsPlaying();
  const isThisPlaying = !!track && currentTrack?.id === track.id && isPlaying;

  if (isLoading) {
    return (
      <aside className={cn('space-y-4 rounded-lg border bg-card p-4', className)}>
        <Skeleton className="aspect-square w-full rounded-lg" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </aside>
    );
  }

  if (!track) {
    return (
      <aside
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 p-8 text-center',
          className,
        )}
      >
        <Music className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="font-medium text-sm">No track selected</p>
        <p className="text-muted-foreground text-sm">
          Select a row to preview it and rate it here.
        </p>
      </aside>
    );
  }

  const keyLabel = formatKey(track.mfKey);
  const genres = (track.genres as string[]) ?? [];
  const subgenres = (track.subgenres as string[]) ?? [];

  return (
    <aside className={cn('space-y-4 rounded-lg border bg-card p-4', className)}>
      <div className="inline-flex justify-between">
        <div className="relative aspect-square w-2/3 overflow-hidden rounded-lg bg-muted">
          {track.imagePath ? (
            <img
              src={apiUrl(`/api/images/serve?imagePath=${track.imagePath}`)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music className="h-10 w-10 text-muted-foreground" aria-hidden />
            </div>
          )}
          <Button
            size="icon"
            variant="secondary"
            className="absolute bottom-3 left-3 h-11 w-11 rounded-full shadow-md"
            onClick={() => onTogglePlay(track)}
            aria-label={isThisPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          >
            {isThisPlaying ? (
              <Pause className="h-5 w-5" aria-hidden />
            ) : (
              <Play className="h-5 w-5" aria-hidden />
            )}
          </Button>
        </div>
        <div className="grid grid-rows-3 gap-3 rounded-md bg-muted/50 p-3 h-auto w-30">
          <Stat
            label="BPM"
            value={
              typeof track.mfTempo === 'number' && track.mfTempo > 0
                ? String(Math.round(track.mfTempo))
                : '—'
            }
          />
          <Stat label="Key" value={keyLabel ?? '—'} />
          <Stat label="Length" value={formatTime(track.duration ?? 0)} />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-start gap-2">
          <h2 className="font-semibold text-lg capitalize leading-tight">{track.title}</h2>
          <AudioQualityBadge format={track.format} hqAudioPath={track.hqAudioPath} />
        </div>
        <p className="text-muted-foreground capitalize">{track.artist}</p>
      </div>

      {(genres.length > 0 || subgenres.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {genres.map((genre) => (
            <Badge key={`genre-${genre}`} variant="secondary" size="xs" className="capitalize">
              {genre}
            </Badge>
          ))}
          {subgenres.map((subgenre) => (
            <Badge key={`subgenre-${subgenre}`} variant="outline" size="xs" className="capitalize">
              {subgenre}
            </Badge>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {[
          findFeatureLabel(danceabilityFeelingOptions, track.mfDanceabilityFeeling),
          findFeatureLabel(arousalMoodOptions, track.mfArousalMood),
          findFeatureLabel(valenceMoodOptions, track.mfValenceMood),
        ].some(Boolean) && (
          <div className="flex flex-wrap gap-1">
            {findFeatureLabel(danceabilityFeelingOptions, track.mfDanceabilityFeeling) && (
              <Badge variant="outline" size="xs">
                {findFeatureLabel(danceabilityFeelingOptions, track.mfDanceabilityFeeling)}
              </Badge>
            )}
            {findFeatureLabel(arousalMoodOptions, track.mfArousalMood) && (
              <Badge variant="outline" size="xs">
                {findFeatureLabel(arousalMoodOptions, track.mfArousalMood)}
              </Badge>
            )}
            {findFeatureLabel(valenceMoodOptions, track.mfValenceMood) && (
              <Badge variant="outline" size="xs">
                {findFeatureLabel(valenceMoodOptions, track.mfValenceMood)}
              </Badge>
            )}
          </div>
        )}
        <FeatureBar label="Danceability" value={track.mfDanceability} />
        <FeatureBar label="Instrumentalness" value={track.mfInstrumentalness} />
        <FeatureBar label="Voice" value={track.mfVoice} />
      </div>

      <SwipeControls
        onLike={() => onRate(track.id, 'like')}
        onDislike={() => onRate(track.id, 'dislike')}
        onBanger={() => onRate(track.id, 'banger')}
        disabled={isRating}
        className="mt-0"
      />

      <Button asChild variant="outline" size="sm" className="w-full">
        <Link to="/research/{-$trackId}" params={{ trackId: track.id }} preload="intent">
          <Brain className="mr-2 h-4 w-4" aria-hidden />
          Research this track
        </Link>
      </Button>
    </aside>
  );
}
