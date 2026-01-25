'use client';

import { SimpleMusicTrack } from '@/__generated__/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
  useCurrentTrack,
  useIsPlaying
} from '@/contexts/audio-player-context';
import { cn } from '@/lib/utils';
import {
  AnimatePresence,
  motion,
  useMotionValue
} from 'motion/react';
import { useEffect, useState } from 'react';
import { Badge } from '../ui/badge';
import { SwipeControls } from './swipe-controls';

interface SwipeTrackProps {
  track: SimpleMusicTrack;
  onLike: () => void;
  onDislike: () => void;
  onBanger: () => void;
}


export function SwipeTrack({
  track,
  onLike,
  onDislike,
  onBanger,
}: SwipeTrackProps) {
  const [audioBars, setAudioBars] = useState([30, 60, 45]);



  // Audio player hooks
  const { currentTrack, } = useCurrentTrack();
  const isPlaying = useIsPlaying();

  // Check if this track is currently playing
  const isCurrentTrack = currentTrack?.id === track.id;
  const isThisTrackPlaying = isCurrentTrack && isPlaying;

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Animate audio bars when playing
  useEffect(() => {
    if (!isPlaying || !track) return;

    const interval = setInterval(() => {
      setAudioBars([
        Math.random() * 40 + 20,
        Math.random() * 50 + 40,
        Math.random() * 40 + 30,
      ]);
    }, 150);

    return () => clearInterval(interval);
  }, [isPlaying, track]);

  // TODO : add filter button, display next track on the top and auto scroll on action 
  // TODO : put like/dislike/banger animation on the image 
  return (

    <Card
      className={cn(
        'relative h-full w-full gap-0',
        'cursor-pointer',
        'bg-background z-2',
        'py-0',
        'border-none',
        'shadow-none',
      )}
    >

      <CardContent className="flex flex-col items-center justify-center h-full w-full relative overflow-hidden   ">
        <div className="z-0 absolute -right-1/4 w-auto h-7/8  blur-lg opacity-40 overflow-hidden   py-4">
          <img
            src={`http://localhost:3000/api/images/serve?imagePath=${track.imagePath}`}
            alt="Album Art"
            className="   h-full rounded-l-full bg-white"
          />
        </div>
        <div className="z-10 flex flex-row h-full  justify-center items-center w-full p-4">
          <div className="flex flex-col text-left w-full gap-6 ml-10">
            <h3 className="text-3xl font-bold capitalize ">{track.title}</h3>
            <p className="text-base text-muted-foreground capitalize">{track.artist}</p>

          </div>
          <div
            className="flex items-center justify-center h-full w-full gap-3 "
          >
            {/* Audio Visualizer Bars */}
            <div className=" flex  gap-2 h-32 items-center justify-center">
              {audioBars.map((height, index) => (
                <div
                  key={index}
                  className={cn(
                    'w-2 bg-foreground rounded-full transition-all duration-150',
                    isThisTrackPlaying && 'animate-pulse',
                  )}
                  style={{ height: `${height}%`, }}
                />
              ))}
            </div>
            <div className="w-2/3 h-2/3 object-cover  z-1 relative">
              <AnimatePresence initial={false}>
                <motion.img
                  key={`${track.id}-image`}
                  initial={{ y: -300, opacity: 0, paddingBottom: 100 }}
                  animate={{ y: 0, opacity: 1, paddingTop: 0, paddingBottom: 0 }}
                  exit={{ y: 300, opacity: 0, paddingTop: 100 }}
                  transition={{
                    y: { type: "spring", stiffness: 100, damping: 30, duration: 0.5 },
                    opacity: { type: "spring", stiffness: 100, damping: 30, duration: 0.5 },
                  }}

                  src={`http://localhost:3000/api/images/serve?imagePath=${track.imagePath}`}
                  alt="Album Art"
                  className="w-full h-full object-cover rounded-md z-1 absolute "
                />
              </AnimatePresence>
            </div>

            <div className=" flex  gap-2 h-32 items-center justify-center">
              {audioBars.reverse().map((height, index) => (
                <div
                  key={index}
                  className={cn(
                    'w-2 bg-foreground rounded-full transition-all duration-150',
                    isThisTrackPlaying && 'animate-pulse',
                  )}
                  style={{ height: `${height}%`, }}
                />
              ))}
            </div>

          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-row justify-between items-center">
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-2">
            {track?.genres?.map((genre) => (
              <Badge variant="outline" className="text-xs capitalize border-none">{genre}</Badge>
            ))}
          </div>
          <div className="flex flex-row gap-2">
            {track?.subgenres?.map((subgenre) => (
              <Badge variant="secondary" className="text-xs capitalize border-none">#{subgenre}</Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-row justify-center mb-4 text-center">
          <SwipeControls
            onLike={onLike}
            onDislike={onDislike}
            onBanger={onBanger}
            disabled={!track}
          />
        </div>

      </CardFooter>
      {/* Swipe overlay should be on top but not block interactions */}
      {/*    <div className="absolute inset-0 pointer-events-none z-30">
          {getSwipeOverlay()}
        </div> */}
    </Card>
  );
}

interface SwipeViewProps {
  track: SimpleMusicTrack | null;
  isLoading: boolean;
  onLike: () => void;
  onDislike: () => void;
  onBanger: () => void;
}

export function SwipeView({
  track,
  isLoading,
  onLike,
  onDislike,
  onBanger,
}: SwipeViewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px] w-full max-w-md mx-auto">
        <div className="text-lg">Loading next track...</div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="flex items-center justify-center h-[600px] w-full max-w-md mx-auto">
        <div className="text-lg">No more tracks to review</div>
      </div>
    );
  }

  return (
    <SwipeTrack
      track={track}
      onLike={onLike}
      onDislike={onDislike}
      onBanger={onBanger}
    />
  );
}
