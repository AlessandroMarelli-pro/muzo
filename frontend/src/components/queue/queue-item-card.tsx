import { Button } from '@/components/ui/button';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { cn, formatDuration } from '@/lib/utils';
import { QueueItem } from '@/services/queue-hooks';
import { useNavigate } from '@tanstack/react-router';
import { Brain, GripVertical, Pause, Play, Trash2 } from 'lucide-react';

interface QueueItemCardProps {
  queueItem: QueueItem;
  index: number;
  queueItemsCount: number;
  onRemove: (trackId: string) => void;
  removingTrackId: string | null;
  dragHandleProps?: any;
}

export const QueueItemCard = ({
  queueItem,
  queueItemsCount,
  index,
  onRemove,
  removingTrackId,
  dragHandleProps,
}: QueueItemCardProps) => {
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();
  const navigate = useNavigate();

  if (!queueItem.track) {
    return null;
  }

  const isCurrentTrack = currentTrack?.id === queueItem.track.id;
  const isThisTrackPlaying = isCurrentTrack && isPlaying;
  const isRemoving = removingTrackId === queueItem.trackId;

  const formattedImage = queueItem.track.imagePath || 'Unknown Image';

  const handlePlay = (e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    if (currentTrack?.id !== queueItem.track?.id) {
      setCurrentTrack(queueItem.track as any);
      actions.play(queueItem.track!.id);
    } else {
      // Same track - toggle play/pause
      if (isThisTrackPlaying) {
        actions.pause(queueItem.track!.id);
      } else {
        actions.play(queueItem.track!.id);
      }
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-2 hover:bg-muted/50 transition-colors group',
        isCurrentTrack && 'bg-muted/80  ',
        isCurrentTrack &&
        index === 0 &&
        'border-l-2 border-l-primary rounded-t-xl',
        isCurrentTrack &&
        index === queueItemsCount - 1 &&
        'border-l-2 border-l-primary rounded-b-xl',
        isCurrentTrack &&
        index !== 0 &&
        index !== queueItemsCount - 1 &&
        'border-l-2 border-l-primary',
        isRemoving && 'opacity-50',
      )}
    >
      {/* Position and Drag Handle */}
      <div className="flex items-center gap-1 text-muted-foreground text-sm w-6">
        {dragHandleProps && (
          <GripVertical
            {...dragHandleProps}
            className="h-4 w-4 min-h-4 min-w-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          />
        )}
        <span>{index + 1}</span>
      </div>

      {/* Album Art */}
      <img
        src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
        alt="Album Art"
        className="w-8 h-8 object-cover rounded-md"
      />

      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'font-medium truncate capitalize text-sm',
            isCurrentTrack && 'text-primary font-semibold',
          )}
        >
          {queueItem.track.title || queueItem.track.artist}
        </div>
        <div
          className={cn(
            'text-xs truncate capitalize ',
            isCurrentTrack ? 'text-primary/80' : 'text-muted-foreground',
          )}
        >
          {queueItem.track.artist || 'Unknown Artist'}
        </div>
      </div>

      {/* Duration */}
      <div className="text-xs text-muted-foreground">
        {formatDuration(queueItem.track.duration || 0)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0">
        <Button variant="ghost" size="iconSm" onClick={handlePlay}>
          {isThisTrackPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => onRemove(queueItem.trackId)}
          disabled={isRemoving}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          size="iconSm"
          onClick={() => navigate({ to: `/research/${queueItem.track?.id}` })}
          variant="ghost"
        >
          <Brain className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
