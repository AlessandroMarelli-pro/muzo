import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Heart,
  MoreHorizontal,
  Music,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  artCover?: string;
}

interface MusicPlayerBarProps {
  currentTrack?: MusicTrack;
  isPlaying?: boolean;
  currentTime?: number;
  volume?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onSkipBack?: () => void;
  onSkipForward?: () => void;
  onVolumeChange?: (volume: number) => void;
  onSeek?: (time: number) => void;
  onToggleShuffle?: () => void;
  onToggleRepeat?: () => void;
  onToggleFavorite?: () => void;
  onMoreOptions?: () => void;
  className?: string;
}

export function MusicPlayerBar({
  currentTrack,
  isPlaying = false,
  currentTime = 0,
  volume = 50,
  onPlay,
  onPause,
  onSkipBack,
  onSkipForward,
  onVolumeChange,
  onSeek,
  onToggleShuffle,
  onToggleRepeat,
  onToggleFavorite,
  onMoreOptions,
  className,
}: MusicPlayerBarProps) {
  const progress = currentTrack?.duration
    ? (currentTime / currentTrack.duration) * 100
    : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50',
        'flex items-center justify-between px-2 sm:px-4 py-2 h-20 sm:h-16',
        'flex-col sm:flex-row gap-2 sm:gap-0',
        className,
      )}
    >
      {/* Track Info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 order-1 sm:order-1">
        {currentTrack ? (
          <>
            <div className="w-10 h-10 bg-muted rounded-md flex-shrink-0 flex items-center justify-center">
              {currentTrack.artCover ? (
                <img
                  src={currentTrack.artCover}
                  alt={`${currentTrack.artist} - ${currentTrack.title}`}
                  className="w-full h-full rounded-md object-cover"
                />
              ) : (
                <Music className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {currentTrack.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {currentTrack.artist}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFavorite}
              className="h-8 w-8 p-0"
            >
              <Heart className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
              <Music className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">No track selected</p>
            </div>
          </div>
        )}
      </div>

      {/* Player Controls */}
      <div className="flex flex-col items-center gap-1 flex-1 max-w-md order-2 sm:order-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleShuffle}
            className="h-8 w-8 p-0"
          >
            <Shuffle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkipBack}
            className="h-8 w-8 p-0"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={isPlaying ? onPause : onPlay}
            className="h-8 w-8 p-0"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkipForward}
            className="h-8 w-8 p-0"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleRepeat}
            className="h-8 w-8 p-0"
          >
            <Repeat className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 w-full">
          <span className="text-xs text-muted-foreground w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <Progress
            value={progress}
            className="flex-1 h-1"
            onClick={(e) => {
              if (currentTrack?.duration && onSeek) {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                onSeek(percent * currentTrack.duration);
              }
            }}
          />
          <span className="text-xs text-muted-foreground w-10">
            {currentTrack?.duration
              ? formatTime(currentTrack.duration)
              : '0:00'}
          </span>
        </div>
      </div>

      {/* Volume and Options */}
      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end order-3 sm:order-3">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <Progress
            value={volume}
            className="w-16 sm:w-20 h-1 hidden sm:block"
            onClick={(e) => {
              if (onVolumeChange) {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                onVolumeChange(percent * 100);
              }
            }}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMoreOptions}
          className="h-8 w-8 p-0"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
