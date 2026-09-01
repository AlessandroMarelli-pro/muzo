import { Button } from '@/components/ui/button';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { capitalizeEveryWord, cn, formatDuration } from '@/lib/utils';
import { QueueItem } from '@/services/queue-hooks';
import { Link } from '@tanstack/react-router';
import { Brain, GripVertical, Music2, Pause, Play, Trash2, AudioLines } from 'lucide-react';
import { memo } from 'react';
import { apiUrl } from '@/lib/api-config';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';

interface QueueItemCardProps {
  queueItem: QueueItem;
  index: number;
  onRemove: (trackId: string) => void;
  removingTrackId: string | null;
  dragHandleProps?: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  };
}

export const QueueItemCard = memo(
  ({ queueItem, index, onRemove, removingTrackId, dragHandleProps }: QueueItemCardProps) => {
    const { currentTrack, setCurrentTrack } = useCurrentTrack();
    const actions = useAudioPlayerActions();
    const isPlaying = useIsPlaying();

    if (!queueItem.track) {
      return null;
    }

    const isCurrentTrack = currentTrack?.id === queueItem.track.id;
    const isThisTrackPlaying = isCurrentTrack && isPlaying;
    const isRemoving = removingTrackId === queueItem.trackId;

    const trackTitle = capitalizeEveryWord(queueItem.track.title || 'Untitled Track');
    const trackArtist = capitalizeEveryWord(queueItem.track.artist || 'Unknown Artist');

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
          'group relative flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50',
          isCurrentTrack && 'bg-primary/10',
          isRemoving && 'opacity-50',
        )}
      >
        {isCurrentTrack && (
          <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />
        )}
        {/* Drag handle — sits in the gutter, only visible on hover/focus. */}
        {dragHandleProps && (
          <GripVertical
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
            aria-label="Drag to reorder"
            className="size-4 shrink-0 cursor-grab rounded-sm text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-40 active:cursor-grabbing"
          />
        )}
        {/* Position */}
        <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
          {index + 1}
        </span>

        {/* Album Art */}
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
          {queueItem.track.imagePath ? (
            <img
              src={apiUrl(`/api/images/serve?imagePath=${queueItem.track.imagePath}`)}
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
              <AudioLines className="h-5 w-5 text-primary animate-pulse" aria-hidden />
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'line-clamp-2 text-sm font-medium leading-snug',
              isCurrentTrack && 'font-semibold text-primary',
            )}
            title={trackTitle}
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

        {/* Duration — yields to the actions on hover/focus. */}
        <div className="font-mono text-xs tabular-nums text-muted-foreground transition-opacity group-focus-within:opacity-0 group-hover:opacity-0">
          {formatDuration(queueItem.track.duration || 0)}
        </div>

        {/* Actions — revealed on hover/focus, sitting over the duration slot. */}
        <div className="absolute right-3 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="iconSm"
            className="size-8"
            onClick={handlePlay}
            aria-label={isThisTrackPlaying ? 'Pause' : 'Play'}
          >
            {isThisTrackPlaying ? (
              <Pause className="size-4" aria-hidden />
            ) : (
              <Play className="size-4 translate-x-px" aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            className="size-8"
            onClick={() => onRemove(queueItem.trackId)}
            disabled={isRemoving}
            aria-label="Remove from queue"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
          <Button asChild size="iconSm" variant="ghost" className="size-8">
            <Link
              to="/research/{-$trackId}"
              params={{ trackId: queueItem.track?.id ?? '' }}
              preload="intent"
              aria-label="Open research"
            >
              <Brain className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    );
  },
);
