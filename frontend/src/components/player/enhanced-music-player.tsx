import { Button } from '@/components/ui/button';
import {
  useAudioPlayerActions,
  useAudioPlayerContext,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { cn } from '@/lib/utils';
import { useWaveformData } from '@/services/music-player-hooks';
import { useQueue } from '@/services/queue-hooks';
import { useNavigate } from '@tanstack/react-router';
import {
  Brain,
  Heart,
  Pause,
  Play,
  Shuffle,
  SkipBack,
  SkipForward,
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
  const navigate = useNavigate();

  // Audio player hooks
  const { currentTrack, } = useCurrentTrack();
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
  // Update audio element when track changes - reload the audio source
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      // When track changes, reload the audio element to load the new source
      audioRef.current.load();
    }
  }, [currentTrack?.id]);

  // Update audio element when state changes
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.volume = playbackState.volume;
      audioRef.current.playbackRate = playbackState.playbackRate;
      audioRef.current.muted = false;
      if (isPlaying && playbackState.trackId === currentTrack.id) {
        // Only play if the playback state matches the current track
        // Use a promise to handle potential play() errors
        audioRef.current.play().catch((error) => {
          console.error('Error playing audio:', error);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [
    isPlaying,
    playbackState.volume,
    playbackState.playbackRate,
    playbackState.isFavorite,
    playbackState.trackId,
    currentTrack?.id,
  ]);

  // Queries for visualizations
  const { data: waveformData = [...Array(200)].map(() => 0.05) } =
    useWaveformData(currentTrack?.id || '');

  // Audio element event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      // Track ended, trigger next track
      actions.next();
    };

    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [actions]);

  const handleToggleFavorite = () => {
    if (!currentTrack) return;
    actions.toggleFavorite(currentTrack.id);
  };

  const handleToggleResearch = () => {
    if (!currentTrack) return;
    navigate({ to: `/research/${currentTrack.id}` });
  };

  const handlePlay = () => {
    if (!currentTrack) return;

    if (isPlaying) {
      actions.pause(currentTrack.id);
    } else {
      actions.play(currentTrack.id);
    }
  };

  const handlePreviousTrack = () => {
    actions.previous();
  };

  const handleNextTrack = () => {
    actions.next();
  };

  // Note: Volume and playback rate controls removed for simplification
  // They can be re-added later if needed by calling mutations directly

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
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleResearch}
                className="h-8 w-8 p-0"
              >
                <Brain className="h-4 w-4" />
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
            {/* Volume controls removed for simplification */}
          </div>
        </div>
      </div>
      {/* Advanced Controls */}
      {showAdvancedControls && (
        <div className="px-4 py-2 border-t border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {/* Playback rate controls removed for simplification */}
              <span className="text-xs text-muted-foreground">
                Rate: {playbackState.playbackRate}x
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
