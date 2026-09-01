import { TrackRecommendation } from '@/__generated__/types';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { capitalizeEveryWord, cn } from '@/lib/utils';
import { useNavigate } from '@tanstack/react-router';
import { AudioLines, Brain, InfoIcon, ListMusic, Pause, Play, Plus } from 'lucide-react';
import { AudioQualityBadge } from '../track/audio-quality-badge';
import { TrackMoreMenu } from '../track/track-more-menu';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { apiUrl } from '@/lib/api-config';

export const TrackRecommendationsCardSkeleton = ({ index }: { index: number }) => {
  return (
    <div
      key={`skeleton-recommendations-card-${index}`}
      className={cn('flex items-center gap-3 p-3')}
    >
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  );
};

export const TrackRecommendationsCard = ({
  recommendation,
  onAddTrack,
  index,
  recommendationsLength,
}: {
  recommendation: TrackRecommendation;
  onAddTrack?: (trackId: string, artist: string, title: string) => void;
  index: number;
  recommendationsLength: number;
}) => {
  const track = recommendation.track;
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();
  const navigate = useNavigate();
  // Only check if this specific track is the current track and playing
  const isCurrentTrack = currentTrack?.id === track.id;
  const isThisTrackPlaying = isCurrentTrack && isPlaying;

  const artUrl = track.imagePath
    ? apiUrl(`/api/images/serve?imagePath=${encodeURIComponent(track.imagePath)}`)
    : null;
  const artistLabel = track.artist ? capitalizeEveryWord(track.artist) : 'Unknown artist';
  const titleLabel = track.title ? capitalizeEveryWord(track.title) : 'Unknown track';
  const label = `${artistLabel} — ${titleLabel}`;

  const handlePlay = (e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    if (currentTrack?.id !== track.id) {
      setCurrentTrack(track);
      actions.play(track.id);
    } else {
      // Same track - toggle play/pause
      if (isThisTrackPlaying) {
        actions.pause(track.id);
      } else {
        actions.play(track.id);
      }
    }
  };
  const handleAddTrack = (e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    if (onAddTrack) {
      onAddTrack(track.id, track.artist || '', track.title || '');
    }
  };
  const handleResearch = (e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    navigate({ to: `/research/${track.id}` });
  };
  return (
    <div
      key={recommendation.track.id}
      aria-current={isCurrentTrack ? 'true' : undefined}
      className={cn(
        'group flex items-center gap-3 p-3 transition-colors hover:bg-muted/50',
        isCurrentTrack && 'bg-muted/80 border-l-2 border-l-primary',
        isCurrentTrack && index === 0 && 'rounded-t-xl',
        isCurrentTrack && index === recommendationsLength - 1 && 'rounded-b-xl',
      )}
    >
      {artUrl ? (
        <img
          src={artUrl}
          alt=""
          loading="lazy"
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center"
          aria-hidden
        >
          <ListMusic className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Track info — two lines: title, then muted meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {isThisTrackPlaying && (
            <AudioLines className="h-4 w-4 shrink-0 text-primary" aria-label="Now playing" />
          )}
          <span className="truncate text-sm font-medium">{label}</span>
          <AudioQualityBadge format={track.format} hqAudioPath={track.hqAudioPath} />
          {recommendation.reasons.length > 0 && (
            <Tooltip>
              <TooltipTrigger aria-label="Why this is recommended">
                <InfoIcon className="h-3.5 w-3.5 shrink-0 cursor-pointer text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-background text-foreground">
                <div className="flex flex-col gap-2">
                  {recommendation.reasons.map((reason) => (
                    <Badge key={reason} variant="accent" className="text-xs">
                      {reason}
                    </Badge>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">
            {track.mfTempo ? `${Math.round(track.mfTempo)} BPM` : '— BPM'}
          </span>
          {track.genres && track.genres.length > 0 && (
            <span className="capitalize"> · {track.genres.slice(0, 3).join(', ')}</span>
          )}
          {track.subgenres && track.subgenres.length > 0 && (
            <span className="capitalize"> · {track.subgenres.slice(0, 3).join(', ')}</span>
          )}
        </p>
      </div>

      {/* Actions — fixed column so rows don't jitter */}
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="iconSm" onClick={handlePlay} aria-label="Play">
          {isThisTrackPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 translate-x-px" />
          )}
        </Button>
        <Button size="iconSm" onClick={handleResearch} variant="ghost" aria-label="Research">
          <Brain className="h-4 w-4" />
        </Button>
        {onAddTrack ? (
          <Button size="iconSm" onClick={handleAddTrack} variant="ghost" aria-label="Add">
            <Plus className="h-4 w-4" />
          </Button>
        ) : (
          <TrackMoreMenu
            trackId={track.id}
            artist={track.artist || 'Unknown Artist'}
            title={track.title || 'Unknown Track'}
            format={track.format}
            hqAudioPath={track.hqAudioPath}
            imagePath={track.imagePath}
          />
        )}
      </div>
    </div>
  );
};
