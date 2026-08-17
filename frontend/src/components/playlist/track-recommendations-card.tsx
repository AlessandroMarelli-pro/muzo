import { TrackRecommendation } from '@/__generated__/types';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { cn } from '@/lib/utils';
import { useNavigate } from '@tanstack/react-router';
import { Brain, InfoIcon, Pause, Play, Plus } from 'lucide-react';
import { AudioQualityBadge } from '../track/audio-quality-badge';
import { GenresBadge } from '../track/genres-badge';
import { TrackMoreMenu } from '../track/track-more-menu';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export const TrackRecommendationsCardSkeleton = ({ index }: { index: number }) => {
  return (
    <div
      key={`skeleton-recommendations-card-${index}`}
      className={cn('flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors group')}
    >
      <Skeleton className="min-w-15 min-h-15 w-15 h-15 rounded-md" />

      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <div className="flex text-foreground truncate capitalize gap-2">
          <Skeleton className="w-20 h-6" />
          <Skeleton className="w-20 h-6" />
        </div>

        {/* Similarity Reasons */}
        <div className="flex flex-wrap gap-2 mt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i + '-skeleton-similarity-reason'} className="w-30 h-6" />
          ))}
        </div>
      </div>

      {/* Track Details */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Skeleton className="w-10 h-6" />
        <Skeleton className="w-10 h-6" />
        <Skeleton className="w-10 h-6" />
        <Skeleton className="w-10 h-6" />
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

  const formattedImage = track.imagePath || 'Unknown Image';

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
      className={cn(
        'flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors group',
        isThisTrackPlaying && 'bg-muted/80  ',
        isThisTrackPlaying && index === 0 && 'border-l-2 border-l-primary rounded-t-xl',
        isCurrentTrack &&
          index === recommendationsLength - 1 &&
          'border-l-2 border-l-primary rounded-b-xl',
        isCurrentTrack &&
          index !== 0 &&
          index !== recommendationsLength - 1 &&
          'border-l-2 border-l-primary',
      )}
    >
      <img
        src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
        alt="Album Art"
        className="w-10 h-10 object-cover rounded-full"
      />
      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <div className="flex text-foreground truncate capitalize gap-2 text-sm">
          <span className="max-w-md truncate capitalize">
            {track?.artist?.toLowerCase() || 'Unknown Artist'} -{' '}
            {track?.title?.toLowerCase() || 'Unknown Track'}{' '}
          </span>
          <Badge variant="outline" className="text-xs border-none">
            {track.mfTempo} BPM
          </Badge>
          <AudioQualityBadge format={track.format} hqAudioPath={track.hqAudioPath} />

          {/* Similarity Reasons */}
          {recommendation.reasons.length > 0 && (
            <div className="flex flex-wrap ">
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="w-4 h-4 cursor-pointer" />
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
            </div>
          )}
        </div>
      </div>
      {/* Track Details */}
      <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
        <div className="flex flex-row gap-2 justify-end items-end">
          <div className="flex flex-wrap gap-2">
            <GenresBadge genres={track.genres || []} variant="secondary" />
          </div>
          <div className="flex flex-wrap gap-2">
            <GenresBadge genres={track.subgenres || []} variant="outline" />
          </div>
        </div>

        {
          <Button variant="ghost" size="iconSm" onClick={handlePlay}>
            {isThisTrackPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
        }
        <Button size="iconSm" onClick={handleResearch} variant="ghost">
          <Brain className="h-4 w-4 " />
        </Button>
        {onAddTrack ? (
          <Button size="iconSm" onClick={handleAddTrack} variant="ghost">
            <Plus className="h-4 w-4 " />
          </Button>
        ) : (
          <TrackMoreMenu
            trackId={track.id}
            artist={track.artist || 'Unknown Artist'}
            title={track.title || 'Unknown Track'}
            format={track.format}
            hqAudioPath={track.hqAudioPath}
          />
        )}
      </div>
    </div>
  );
};
