import { TrackRecommendation } from '@/__generated__/types';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { formatDuration } from '@/lib/utils';
import { useNavigate } from '@tanstack/react-router';
import { Brain, Clock, Pause, Play, Plus } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

export const TrackRecommendationsCard = ({
  recommendation,
  onAddTrack,
  setQueue,
}: {
  recommendation: TrackRecommendation;
  onAddTrack?: (trackId: string) => void;
  setQueue?: () => void;
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
  console.log(recommendation);
  return (
    <div
      key={recommendation.track.id}
      className="flex items-center gap-4 p-4  rounded-lg hover:bg-muted/50 transition-colors"
    >
      <img
        src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
        alt="Album Art"
        className="w-10 h-10 object-cover rounded-md"
      />
      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate capitalize">
          {track?.title || 'Unknown Track'}
        </div>
        <div className="text-sm text-muted-foreground truncate capitalize">
          {track?.artist || 'Unknown Artist'}
        </div>

        {/* Similarity Reasons */}
        {recommendation.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {recommendation.reasons.slice(0, 3).map((reason, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {reason}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Track Details */}
      <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
        {track?.tempo && (
          <Badge variant="outline" className="text-xs">
            {track.tempo} BPM
          </Badge>
        )}
        {track?.genres && track.genres.length > 0 && (
          <>
            {track.genres.map((genre, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {genre}
              </Badge>
            ))}
          </>
        )}
        {track?.subgenres && track.subgenres.length > 0 && (
          <>
            {track.subgenres.map((subgenre, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {subgenre}
              </Badge>
            ))}
          </>
        )}
        {track?.duration && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatDuration(track.duration)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {setQueue && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (currentTrack?.id !== track.id) {
                setCurrentTrack(track);
              }
              setQueue();
              actions.togglePlayPause(track.id);
            }}
          >
            {isThisTrackPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
        )}
        {onAddTrack && (
          <Button
            size="sm"
            onClick={() => onAddTrack(track.id)}
            variant="ghost"
          >
            <Plus className="h-4 w-4 " />
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => navigate({ to: `/research/${track.id}` })}
          variant="ghost"
        >
          <Brain className="h-4 w-4 " />
        </Button>
      </div>
    </div>
  );
};
