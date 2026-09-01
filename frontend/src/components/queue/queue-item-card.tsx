import { Button } from '@/components/ui/button';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { cn, formatDuration } from '@/lib/utils';
import { QueueItem } from '@/services/queue-hooks';
import { Link } from '@tanstack/react-router';
import {
  Brain,
  GripVertical,
  Music2,
  Pause,
  Play,
  Trash2,
  AudioLines,
} from 'lucide-react';
import { memo } from 'react';
import { apiUrl } from '@/lib/api-config';
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from '@dnd-kit/core';

interface QueueItemCardProps {
  queueItem: QueueItem;
  index: number;
  queueItemsCount: number;
  onRemove: (trackId: string) => void;
  removingTrackId: string | null;
  dragHandleProps?: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  };
}

export const QueueItemCard = memo(
  ({
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

    if (!queueItem.track) {
      return null;
    }

    const isCurrentTrack = currentTrack?.id === queueItem.track.id;
    const isThisTrackPlaying = isCurrentTrack && isPlaying;
    const isRemoving = removingTrackId === queueItem.trackId;

    const trackTitle = queueItem.track.title || 'Untitled Track';
    const trackArtist = queueItem.track.artist || 'Unknown Artist';

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
          'flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors group',
          isCurrentTrack && 'bg-primary/10',
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
              {...dragHandleProps.attributes}
              {...dragHandleProps.listeners}
              aria-label="Drag to reorder"
              className="h-4 w-4 min-h-4 min-w-4 opacity-40 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm transition-opacity cursor-grab active:cursor-grabbing"
            />
          )}
          <span>{index + 1}</span>
        </div>

        {/* Album Art */}
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
          {queueItem.track.imagePath ? (
            <img
              src={apiUrl(
                `/api/images/serve?imagePath=${queueItem.track.imagePath}`,
              )}
              alt={`${trackTitle} album art`}
              width={44}
              height={44}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music2 className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
          )}
          {isThisTrackPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <AudioLines
                className="h-5 w-5 text-primary animate-pulse"
                aria-hidden
              />
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'font-medium truncate text-sm',
              isCurrentTrack && 'text-primary font-semibold',
            )}
          >
            {trackTitle}
          </div>
          <div
            className={cn(
              'text-xs truncate',
              isCurrentTrack ? 'text-primary/80' : 'text-muted-foreground',
            )}
          >
            {trackArtist}
          </div>
        </div>

        {/* Duration */}
        <div className="text-xs text-muted-foreground">
          {formatDuration(queueItem.track.duration || 0)}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={handlePlay}
            aria-label={isThisTrackPlaying ? 'Pause' : 'Play'}
          >
            {isThisTrackPlaying ? (
              <Pause className="h-5 w-5" aria-hidden />
            ) : (
              <Play className="h-5 w-5 ml-0.5" aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => onRemove(queueItem.trackId)}
            disabled={isRemoving}
            aria-label="Remove from queue"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
          <Button asChild size="iconSm" variant="ghost">
            <Link
              to="/research/{-$trackId}"
              params={{ trackId: queueItem.track?.id ?? '' }}
              preload="intent"
              aria-label="Open research"
            >
              <Brain className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    );
  },
);
