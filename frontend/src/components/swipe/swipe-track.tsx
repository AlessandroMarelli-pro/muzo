'use client';

import { SimpleMusicTrack } from '@/__generated__/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { cn } from '@/lib/utils';
import { Flame, Heart, X } from 'lucide-react';
import {
  motion,
  PanInfo,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from 'motion/react';
import { useEffect, useState } from 'react';
import { Badge } from '../ui/badge';
import { SwipeControls } from './swipe-controls';

interface SwipeTrackProps {
  track: SimpleMusicTrack;
  onLike: () => void;
  onDislike: () => void;
  onBanger: () => void;
  triggerSwipeDirection?: 'left' | 'right' | 'up' | null;
}

const SWIPE_THRESHOLD = 100;
const DRAG_THRESHOLD = 30; // Minimum drag distance to show overlay

export function SwipeTrack({
  track,
  onLike,
  onDislike,
  onBanger,
  triggerSwipeDirection,
}: SwipeTrackProps) {
  const [audioBars, setAudioBars] = useState([30, 60, 45]);

  const [isExiting, setIsExiting] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<
    'left' | 'right' | 'up' | null
  >(null);
  const [currentDragDirection, setCurrentDragDirection] = useState<
    'left' | 'right' | 'up' | null
  >(null);
  const [isHovered, setIsHovered] = useState(false);

  // Audio player hooks
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();

  // Check if this track is currently playing
  const isCurrentTrack = currentTrack?.id === track.id;
  const isThisTrackPlaying = isCurrentTrack && isPlaying;

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotate = useTransform(x, [-300, 300], [-30, 30]);
  const opacity = useTransform(
    x,
    [-300, -SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD, 300],
    [0, 1, 1, 1, 0],
  );

  const [dragDistance, setDragDistance] = useState(0);
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

  // Trigger swipe animation when button is clicked
  useEffect(() => {
    if (triggerSwipeDirection && !isExiting) {
      // Simulate the swipe animation
      setIsExiting(true);
      setSwipeDirection(triggerSwipeDirection);
      setCurrentDragDirection(triggerSwipeDirection);
      setDragDistance(SWIPE_THRESHOLD);

      // Animate the card position based on direction
      if (triggerSwipeDirection === 'left') {
        x.set(-50);
      } else if (triggerSwipeDirection === 'right') {
        x.set(50);
      } else if (triggerSwipeDirection === 'up') {
        y.set(-50);
      }

      // Reset animation state after it completes (parent handles action)
      setTimeout(() => {
        setCurrentDragDirection(null);
        setDragDistance(0);
        x.set(0);
        y.set(0);
        setIsExiting(false);
        setSwipeDirection(null);
      }, 400);
    }
  }, [triggerSwipeDirection, isExiting, x, y]);

  // Update current drag direction and distance based on x and y values
  useMotionValueEvent(x, 'change', (latestX) => {
    const latestY = y.get();
    updateDragState(latestX, latestY);
  });

  useMotionValueEvent(y, 'change', (latestY) => {
    const latestX = x.get();
    updateDragState(latestX, latestY);
  });

  const updateDragState = (latestX: number, latestY: number) => {
    const absX = Math.abs(latestX);
    const absY = Math.abs(latestY);
    const distance = Math.sqrt(latestX * latestX + latestY * latestY);
    setDragDistance(distance);

    if (distance < DRAG_THRESHOLD) {
      setCurrentDragDirection(null);
      return;
    }

    // Determine primary direction
    if (absY > absX && latestY < 0) {
      setCurrentDragDirection('up');
    } else if (absX > absY) {
      setCurrentDragDirection(latestX > 0 ? 'right' : 'left');
    } else {
      setCurrentDragDirection(null);
    }
  };

  const handleSwipe = async (direction: 'left' | 'right' | 'up') => {
    if (isExiting) return;

    setIsExiting(true);
    setSwipeDirection(direction);

    try {
      if (direction === 'up') {
        await onBanger();
      } else if (direction === 'right') {
        await onLike();
      } else if (direction === 'left') {
        await onDislike();
      }
    } catch (error) {
      console.error('Error swiping track:', error);
      setIsExiting(false);
      setSwipeDirection(null);
      setCurrentDragDirection(null);
      setDragDistance(0);
      x.set(0);
      y.set(0);
      return;
    }

    // Wait for animation to complete before calling onSwipeComplete
    setTimeout(() => {
      setCurrentDragDirection(null);
      setDragDistance(0);
    }, 400);
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (isExiting) return;

    const { offset, velocity } = info;
    const swipeVelocity =
      Math.abs(velocity.x) > Math.abs(velocity.y) ? velocity.x : velocity.y;

    // Check for vertical swipe (up = banger)
    if (
      Math.abs(offset.y) > Math.abs(offset.x) &&
      Math.abs(offset.y) > SWIPE_THRESHOLD
    ) {
      if (offset.y < 0) {
        handleSwipe('up');
        return;
      }
    }

    // Check for horizontal swipe
    if (Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(swipeVelocity) > 500) {
      if (offset.x > 0 || swipeVelocity > 0) {
        handleSwipe('right');
      } else {
        handleSwipe('left');
      }
    } else {
      // Snap back to center
      x.set(0);
      y.set(0);
      setCurrentDragDirection(null);
      setDragDistance(0);
    }
  };

  // Calculate overlay opacity based on drag distance (reactive)
  const overlayOpacity = Math.min(
    Math.max(
      (dragDistance - DRAG_THRESHOLD) / (SWIPE_THRESHOLD - DRAG_THRESHOLD),
      0,
    ),
    0.8,
  );

  const getSwipeOverlay = () => {
    // Show overlay during drag or after swipe completion
    const direction = swipeDirection || currentDragDirection;
    if (!direction) return null;

    const overlayStyles = {
      left: 'bg-red-500/20 border-red-500',
      right: 'bg-blue-500/20 border-blue-500',
      up: 'bg-orange-500/20 border-orange-500',
    };

    const icons = {
      left: <X className="w-16 h-16 text-red-500" />,
      right: <Heart className="w-16 h-16 text-blue-500" />,
      up: <Flame className="w-16 h-16 text-orange-500" />,
    };

    const isCompleted = !!swipeDirection;
    const finalOpacity = isCompleted ? 1 : overlayOpacity;

    return (
      <motion.div
        className={cn(
          'absolute inset-0 flex items-center justify-center rounded-xl border-2',
          overlayStyles[direction],
        )}
        style={{
          opacity: finalOpacity,
        }}
        animate={{
          scale: isCompleted ? 1.1 : 1,
        }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        <motion.div
          animate={{
            scale: isCompleted ? 1.2 : 1,
            rotate: isCompleted
              ? direction === 'left'
                ? -10
                : direction === 'right'
                  ? 10
                  : 0
              : 0,
          }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {icons[direction]}
        </motion.div>
      </motion.div>
    );
  };

  const handleDrag = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const latestX = info.offset.x;
    const latestY = info.offset.y;
    updateDragState(latestX, latestY);
  };

  const playMusic = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentTrack?.id !== track.id) {
      setCurrentTrack(track);
      actions.play(track.id);
    } else {
      // Same track - toggle play/pause
      if (isThisTrackPlaying) {
        actions.pause(track.id);
      } else {
        actions.play(track.id);
      }
    }
  };


  // TODO : add filter button, display next track on the top and auto scroll on action 
  // TODO : put like/dislike/banger animation on the image 
  return (
    <motion.div
      className=" w-full h-full"
      style={{
        x,
        y,
        rotate,
        opacity,
      }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      animate={
        isExiting ? { scale: 0.8, opacity: 0 } : { scale: 1, opacity: 1 }
      }
      transition={{ duration: 0.3 }}
    >
      <Card
        className={cn(

          'relative h-full w-full gap-0',
          'cursor-pointer',
          'bg-background z-2',
          'py-0',
          'border-none',
          'shadow-none',
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
              <img
                src={`http://localhost:3000/api/images/serve?imagePath=${track.imagePath}`}
                alt="Album Art"
                className="w-2/3 h-2/3 object-cover rounded-md z-1"
              />
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
        <div className="absolute inset-0 pointer-events-none z-30">
          {getSwipeOverlay()}
        </div>
      </Card>
    </motion.div>
  );
}

interface SwipeViewProps {
  track: SimpleMusicTrack | null;
  isLoading: boolean;
  onLike: () => void;
  onDislike: () => void;
  onBanger: () => void;
  onSwipeComplete: () => void;
  triggerSwipeDirection?: 'left' | 'right' | 'up' | null;
}

export function SwipeView({
  track,
  isLoading,
  onLike,
  onDislike,
  onBanger,
  triggerSwipeDirection,
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
      triggerSwipeDirection={triggerSwipeDirection}
    />
  );
}
