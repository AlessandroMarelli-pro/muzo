import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  useAudioPlayerActions,
  useAudioPlayerContext,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { cn } from '@/lib/utils';
import { useWaveformData } from '@/services/music-player-hooks';
import { useQueue } from '@/services/queue-hooks';
import {
  Heart,
  Pause,
  Play,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { WaveformVisualizer } from './waveform-visualizer';

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  artCover?: string;
}

interface EnhancedMusicPlayerProps {
  currentTrack?: MusicTrack;
  onToggleShuffle?: () => void;
  onToggleRepeat?: () => void;
  className?: string;
  showVisualizations?: boolean;
}

export const EnhancedMusicPlayer = React.memo(function EnhancedMusicPlayer({
  onToggleShuffle,
  className,
}: EnhancedMusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [showAdvancedControls] = useState(false);

  // Audio player hooks
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const { data: queueItems = [] } = useQueue();
  // Map queue items to tracks for backward compatibility
  const queue = queueItems
    .map((item) => item.track)
    .filter((track): track is NonNullable<typeof track> => track !== null);
  const [queueIndex, setQueueIndex] = useState(
    queue.findIndex((track) => track.id === currentTrack?.id) || 0,
  );

  useEffect(() => {
    setQueueIndex(
      queue.findIndex((track) => track.id === currentTrack?.id) || 0,
    );
  }, [currentTrack, queue]);
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();
  const formattedImage = currentTrack?.imagePath || 'Unknown Image';
  // Get full playback state from context
  const { state: playbackState } = useAudioPlayerContext();
  console.log('playbackState', playbackState);
  // Update audio element when state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = playbackState.volume;
      audioRef.current.playbackRate = playbackState.playbackRate;
      audioRef.current.muted = false;
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [
    isPlaying,
    playbackState.volume,
    playbackState.playbackRate,
    playbackState.isFavorite,
  ]);

  // Queries for visualizations
  const { data: waveformData = [...Array(200)].map(() => 0.05) } =
    useWaveformData(currentTrack?.id || '');

  // Audio element event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      // Track ended, could trigger next track logic here
      handleNextTrack();
    };

    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isPlaying]);

  const handleToggleFavorite = () => {
    if (!currentTrack) return;
    actions.toggleFavorite(currentTrack.id);
  };

  const handlePlay = () => {
    console.log('handlePlay', currentTrack);
    if (!currentTrack) {
      console.log('No current track');
      return;
    }
    setQueueIndex(queueIndex);

    actions.togglePlayPause(currentTrack.id);
  };

  const handlePreviousTrack = () => {
    if (!queue) return;
    const nextIndex = queueIndex - 1;
    setQueueIndex(nextIndex);
    setCurrentTrack(queue[nextIndex]);
    actions.togglePlayPause(queue[nextIndex].id);
  };

  const handleNextTrack = () => {
    if (!queue) return;
    const nextIndex = queueIndex + 1;
    setQueueIndex(nextIndex);
    setCurrentTrack(queue[nextIndex]);
    actions.togglePlayPause(queue[nextIndex].id);
  };

  const handleVolumeChange = (newVolume: number) => {
    if (currentTrack) {
      actions.setVolume(currentTrack.id, newVolume / 100);
    }
  };

  const handlePlaybackRateChange = (newRate: number) => {
    if (currentTrack) {
      actions.setPlaybackRate(currentTrack.id, newRate);
    }
  };

  const toggleMute = () => {
    if (playbackState.volume === 0) {
      handleVolumeChange(50); // Default volume
    } else {
      handleVolumeChange(0);
    }
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-background border-t border-border z-[9999]',
        'flex flex-col',
        className,
      )}
    >
      <div className="z-0 absolute top-0 left-0 w-full h-full   opacity-50 ">
        <img
          src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
          alt="Album Art"
          className="w-full h-full object-cover rounded-md "
        />
      </div>
      {/* Main Player Bar */}
      <div className=" backdrop-blur-2xl z-10 flex items-center justify-between  py-2 h-20 sm:h-16 flex-col sm:flex-row gap-2 sm:gap-0">
        {/* Track Info */}
        <div className="z-10 flex  gap-2 sm:gap-3 min-w-0 order-1 sm:order-1 items-center justify-start">
          <div className="w-16 h-16 bg-muted rounded-md flex-shrink-0 flex items-center justify-center ">
            <img
              src={`http://localhost:3000/api/images/serve?imagePath=${formattedImage}`}
              alt="Album Art"
              className="w-16 h-16 object-cover rounded-md rounded-l-none "
            />
          </div>
          {currentTrack && (
            <div className=" flex-1 w-[45%]">
              <p className="text-xs font-medium truncate capitalize">
                {currentTrack.title || 'Unknown Title'}
              </p>
              <p className="text-xs text-muted-foreground truncate capitalize">
                {currentTrack.artist || 'Unknown Artist'}
              </p>
            </div>
          )}
        </div>

        {/* Volume and Options */}
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end order-3 sm:order-3 px-10">
          <div className="flex items-center gap-2">
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
                onClick={handlePreviousTrack}
                className="h-8 w-8 p-0"
                disabled={queueIndex === 0}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handlePlay}
                //disabled={playbackState.isLoading}
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
                onClick={handleNextTrack}
                className="h-8 w-8 p-0"
                disabled={queueIndex === (queue?.length || 0) - 1}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleFavorite}
                className="h-8 w-8 p-0"
                //disabled={playbackState.isLoading}
              >
                <Heart
                  className={cn(
                    'h-4 w-4',
                    playbackState?.isFavorite
                      ? 'fill-red-500 text-red-500'
                      : '',
                  )}
                />
              </Button>
            </div>
            {/* Visualizations */}
            <div className="flex items-center gap-2 w-auto">
              <WaveformVisualizer
                waveformData={waveformData}
                duration={currentTrack?.duration || 0}
                audioRef={audioRef}
                isPlaying={isPlaying}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              className="h-8 w-8 p-0"
            >
              {playbackState.volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Progress
              value={playbackState.volume * 100}
              className="w-16 sm:w-20 h-1 hidden sm:block"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                handleVolumeChange(percent * 100);
              }}
            />
          </div>
        </div>
      </div>
      {/* Advanced Controls */}
      {showAdvancedControls && (
        <div className="px-4 py-2 border-t border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Speed:</span>
              <input
                type="range"
                min="0.25"
                max="4.0"
                step="0.25"
                value={playbackState.playbackRate}
                onChange={(e) =>
                  handlePlaybackRateChange(parseFloat(e.target.value))
                }
                className="w-20"
              />
              <span className="text-xs text-muted-foreground w-8">
                {playbackState.playbackRate}x
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Hidden Audio Element */}
      {currentTrack && (
        <audio
          muted
          ref={audioRef}
          src={
            currentTrack
              ? `http://localhost:3000/api/audio/stream/${currentTrack.id}`
              : undefined
          }
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
});
