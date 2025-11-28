import { cn, formatTime } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface WaveformVisualizerProps {
  waveformData: number[];
  duration: number;
  className?: string;
  isPlaying?: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export function WaveformVisualizer({
  waveformData,
  duration,
  className,
  isPlaying = false,
  audioRef,
}: WaveformVisualizerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const onSeek = (time: number) => {
    if (!audioRef.current) return;

    audioRef.current.currentTime = time;
  };
  // Audio element event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      // Only update local state, don't trigger server mutations
      // This prevents unnecessary seek mutations on every timeupdate
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [isPlaying]);

  return (
    <>
      <span className="text-xs text-muted-foreground w-10 text-right">
        {formatTime(currentTime)}
      </span>
      <div className={cn('relative ', className)}>
        <div className="h-10 cursor-pointer flex flex-row  items-center justify-center  transition-opacity opacity-80 gap-0.5 ">
          {waveformData.map((amplitude, i) => {
            const timeAtPosition = (i / waveformData.length) * duration;
            const isPlayed = timeAtPosition <= currentTime;

            return (
              <div
                onClick={() => onSeek?.(timeAtPosition)}
                className="h-full items-center justify-center flex w-full"
                key={`${amplitude}-${i}`}
              >
                <div
                  className={cn(
                    'flex w-[0.1px] rounded-full min-w-[0.1px] px-[0.5px] ',
                    !isPlaying && 'animate-pulse',
                    !isPlayed
                      ? 'bg-primary dark:bg-primary '
                      : 'bg-chart-3 dark:bg-chart-3',
                  )}
                  style={{
                    height: `${Math.min(100, amplitude * 100)}%`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <span className="text-xs text-muted-foreground w-10">
        {duration ? formatTime(duration) : '0:00'}
      </span>
    </>
  );
}
