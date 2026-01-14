import { TrackRecommendation } from '@/__generated__/types';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { formatDuration } from '@/lib/utils';
import { useNavigate } from '@tanstack/react-router';
import { Brain, Pause, Play, Plus } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

export const TrackRecommendationsCardSkeleton = () => {
  return (
    <div className="flex items-center gap-4 p-4  rounded-lg hover:bg-muted/50 transition-colors">
      <Skeleton className="w-15 h-15" />
    </div>
  );
};
export const TrackRecommendationsCard = ({
  recommendation,
  onAddTrack,
  setQueue,
}: {
  recommendation: TrackRecommendation;
  onAddTrack?: (trackId: string) => void;
  setQueue: () => void;
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
    }
    setQueue();
    actions.togglePlayPause(track.id);
  };
  const handleAddTrack = (e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    if (onAddTrack) {
      onAddTrack(track.id);
    }
  };
  const handleResearch = (e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    navigate({ to: `/research/${track.id}` });
  };
  return (
    <div
      key={recommendation.track.id}
      className="flex items-center gap-4 p-4   hover:bg-muted/50 transition-colors"
    >
      <img
        src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
        alt="Album Art"
        className="w-15 h-15 object-cover rounded-md"
      />
      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <div className="flex text-foreground truncate capitalize gap-2">
          {track?.artist || 'Unknown Artist'} -{' '}
          {track?.title || 'Unknown Track'}{' '}
          <Badge variant="outline" className="text-xs border-none">
            {track.tempo} BPM
          </Badge>
          <Badge variant="outline" className="text-xs border-none">
            {formatDuration(track.duration)}
          </Badge>
        </div>

        {/* Similarity Reasons */}
        {recommendation.reasons.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {recommendation.reasons.slice(0, 3).map((reason, index) => (
              <Badge key={index} variant="accent" className="text-xs">
                {reason}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Track Details */}
      <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
        <div className="flex flex-col gap-2 justify-end items-end">
          <div className="flex flex-wrap gap-2">
            {track?.genres && track.genres.length > 0 && (
              <>
                {track.genres.map((genre, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="text-xs capitalize border-none"
                  >
                    {genre}
                  </Badge>
                ))}
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {track?.subgenres && track.subgenres.length > 0 && (
              <>
                {track.subgenres.map((subgenre, index) => (
                  <Badge
                    key={index}
                    variant="accent"
                    className="text-xs capitalize"
                  >
                    {subgenre}
                  </Badge>
                ))}
              </>
            )}
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
        {onAddTrack && (
          <Button size="iconSm" onClick={handleAddTrack} variant="ghost">
            <Plus className="h-4 w-4 " />
          </Button>
        )}
        <Button size="iconSm" onClick={handleResearch} variant="ghost">
          <Brain className="h-4 w-4 " />
        </Button>
      </div>
    </div>
  );
};
