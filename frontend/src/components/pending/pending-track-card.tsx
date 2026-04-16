'use client';

import { Track } from '@/__generated__/types';
import { SwipeControls } from '@/components/swipe/swipe-controls';
import { Card, CardContent } from '@/components/ui/card';
import { useBangerTrack, useDislikeTrack, useLikeTrack } from '@/services/api-hooks';
import { cn } from '@/lib/utils';
import { useMemo, useRef, useState } from 'react';

interface PendingTrackCardProps {
  track: Track;
  onRated: () => Promise<unknown> | void;
}

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export function PendingTrackCard({ track, onRated }: PendingTrackCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const likeMutation = useLikeTrack();
  const dislikeMutation = useDislikeTrack();
  const bangerMutation = useBangerTrack();

  const isMutating = likeMutation.isPending || dislikeMutation.isPending || bangerMutation.isPending;
  const progressValue = useMemo(() => {
    if (duration <= 0) {
      return 0;
    }
    return currentTime;
  }, [currentTime, duration]);

  const handleMouseEnter = async () => {
    setIsHovered(true);
    if (!audioRef.current) {
      return;
    }
    try {
      await audioRef.current.play();
    } catch (error) {
      console.error('Failed to play preview audio', error);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (!audioRef.current) {
      return;
    }
    audioRef.current.pause();
  };

  const handleSeek = (value: number) => {
    if (!audioRef.current) {
      return;
    }
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const handleRate = async (type: 'like' | 'dislike' | 'banger') => {
    if (type === 'like') {
      await likeMutation.mutateAsync(track.id);
    }
    if (type === 'dislike') {
      await dislikeMutation.mutateAsync(track.id);
    }
    if (type === 'banger') {
      await bangerMutation.mutateAsync(track.id);
    }
    await onRated();
  };

  return (
    <Card
      className="group overflow-hidden border-border/50 bg-card/40 transition-all duration-200 hover:bg-card/70"
      onMouseEnter={() => void handleMouseEnter()}
      onMouseLeave={handleMouseLeave}
    >
      <CardContent className="p-0">
        <div className="relative aspect-video w-full">
          <img
            src={`http://localhost:3000/api/images/serve?imagePath=${track.imagePath}`}
            alt={`${track.artist} - ${track.title}`}
            className="h-full w-full object-cover"
          />
          <div
            className={cn(
              'absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black/80 via-black/40 to-transparent p-4 transition-opacity duration-200',
              isHovered ? 'opacity-100' : 'opacity-0',
            )}
          >
            <div className="mb-3">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={progressValue}
                onChange={(event) => handleSeek(Number(event.target.value))}
                className="h-1 w-full cursor-pointer accent-white"
                aria-label="Audio progress"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-white/80">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            <SwipeControls
              onLike={() => void handleRate('like')}
              onDislike={() => void handleRate('dislike')}
              onBanger={() => void handleRate('banger')}
              disabled={isMutating}
            />
          </div>
        </div>
        <div className="space-y-1 p-4">
          <p className="line-clamp-1 font-semibold text-foreground">{track.title}</p>
          <p className="line-clamp-1 text-sm text-muted-foreground">{track.artist}</p>
        </div>
        <audio
          ref={audioRef}
          src={`http://localhost:3000/api/audio/stream/${track.id}`}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onEnded={() => setCurrentTime(0)}
          preload="metadata"
        />
      </CardContent>
    </Card>
  );
}
