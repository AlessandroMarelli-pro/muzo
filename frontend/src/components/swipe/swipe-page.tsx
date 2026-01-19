'use client';

import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import {
  useBangerTrack,
  useDislikeTrack,
  useLikeTrack,
  useRandomTrackWithStats,
} from '@/services/api-hooks';
import { InfoIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { SwipeView } from './swipe-track';

const UsageTooltip = () => {
  return (
    <Tooltip>
      <TooltipTrigger>
        <InfoIcon className="w-8 h-8 text-foreground hover:text-foreground cursor-pointer" />
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" sideOffset={10} className='bg-secondary text-background p-4'>
        <span className="text-base text-muted-foreground flex flex-col gap-2">
          Swipe right to like, left to dislike, or up for BANGER!
          <span>
            <kbd className="px-2 py-1 bg-background rounded text-xs font-bold capitalize">Space</kbd>{' '}
            play/pause
          </span>
          <span>
            <kbd className="px-2 py-1 bg-background rounded text-xs font-bold capitalize">E</kbd> like
          </span>
          <span><kbd className="px-2 py-1 bg-background rounded text-xs font-bold capitalize">Z</kbd>{' '}
            banger </span>
          <span>
            <kbd className="px-2 py-1 bg-background rounded text-xs font-bold capitalize">A</kbd>{' '}
            dislike
          </span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
};

export function SwipePage() {
  const {
    data: trackData,
    isLoading: isLoadingTrack,
    refetch,
  } = useRandomTrackWithStats();
  const track = trackData?.track || undefined;
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [triggerSwipeDirection, setTriggerSwipeDirection] = useState<
    'left' | 'right' | 'up' | null
  >(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const likeMutation = useLikeTrack();
  const bangerMutation = useBangerTrack();
  const dislikeMutation = useDislikeTrack();

  // Audio player hooks for keyboard controls
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSwipeComplete = useCallback(() => {
    // Reset to get a new random track
    refetch();
  }, [refetch]);

  // Auto-play next track if music was playing
  useEffect(() => {
    if (track && shouldAutoPlay && !isLoadingTrack) {
      setCurrentTrack(track);
      if (isPlaying && currentTrack?.id === track.id) {
        actions.pause(track.id);
      } else {
        actions.play(track.id);
      }
      setShouldAutoPlay(false);
    }
  }, [track, shouldAutoPlay, isLoadingTrack, setCurrentTrack, actions]);

  const handleLike = useCallback(async () => {
    if (!track) return;
    const wasPlaying = isPlaying && currentTrack?.id === track.id;

    // Trigger swipe animation immediately
    setIsAnimating(true);
    setTriggerSwipeDirection('right');

    // Start mutation asynchronously (don't wait)
    const mutationPromise = likeMutation.mutateAsync(track.id);

    // Wait for animation to complete (400ms)
    const animationPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 400);
    });

    // Wait for both animation and mutation to complete
    Promise.all([mutationPromise, animationPromise])
      .then(() => {
        if (wasPlaying) {
          setShouldAutoPlay(true);
        }
        // Reset animation and trigger refetch when both are complete
        setTriggerSwipeDirection(null);
        setIsAnimating(false);
        handleSwipeComplete();
      })
      .catch((error) => {
        console.error('Error liking track:', error);
        setTriggerSwipeDirection(null);
        setIsAnimating(false);
      });
  }, [track, likeMutation, handleSwipeComplete, isPlaying, currentTrack]);

  const handleDislike = useCallback(async () => {
    if (!track) return;

    // Trigger swipe animation immediately
    setIsAnimating(true);
    setTriggerSwipeDirection('left');

    // Start mutation asynchronously (don't wait)
    const mutationPromise = dislikeMutation.mutateAsync(track.id);

    // Wait for animation to complete (400ms)
    const animationPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 400);
    });

    // Wait for both animation and mutation to complete
    Promise.all([mutationPromise, animationPromise])
      .then(() => {
        // Reset animation and trigger refetch when both are complete
        setTriggerSwipeDirection(null);
        setIsAnimating(false);
        handleSwipeComplete();
      })
      .catch((error) => {
        console.error('Error disliking track:', error);
        setTriggerSwipeDirection(null);
        setIsAnimating(false);
      });
  }, [track, dislikeMutation, handleSwipeComplete]);

  const handleBanger = useCallback(async () => {
    if (!track) return;
    const wasPlaying = isPlaying && currentTrack?.id === track.id;

    // Trigger swipe animation immediately
    setIsAnimating(true);
    setTriggerSwipeDirection('up');

    // Start mutation asynchronously (don't wait)
    const mutationPromise = bangerMutation.mutateAsync(track.id);

    // Wait for animation to complete (400ms)
    const animationPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 400);
    });

    // Wait for both animation and mutation to complete
    Promise.all([mutationPromise, animationPromise])
      .then(() => {
        if (wasPlaying) {
          setShouldAutoPlay(true);
        }
        // Reset animation and trigger refetch when both are complete
        setTriggerSwipeDirection(null);
        setIsAnimating(false);
        handleSwipeComplete();
      })
      .catch((error) => {
        console.error('Error banger track:', error);
        setTriggerSwipeDirection(null);
        setIsAnimating(false);
      });
  }, [track, bangerMutation, handleSwipeComplete, isPlaying, currentTrack]);

  // Only show loading if not animating (to prevent loading message during swipe animation)
  const isLoading =
    !isAnimating &&
    (isLoadingTrack ||
      likeMutation.isPending ||
      bangerMutation.isPending ||
      dislikeMutation.isPending);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if not typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (!track || isLoading) return;

      // Spacebar: Play/Pause
      if (event.code === 'Space') {
        event.preventDefault();
        if (currentTrack?.id !== track.id) {
          setCurrentTrack(track);
        }
        if (isPlaying && currentTrack?.id === track.id) {
          actions.pause(track.id);
        } else {
          actions.play(track.id);
        }
        return;
      }

      // Keyboard shortcuts for swiping
      const key = event.key.toLowerCase();

      if (key === 'a') {
        // Dislike
        event.preventDefault();
        handleDislike();
      } else if (key === 'z') {
        // Banger
        event.preventDefault();
        handleBanger();
      } else if (key === 'e') {
        // Like
        event.preventDefault();
        handleLike();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    track,
    currentTrack,
    setCurrentTrack,
    actions,
    isLoading,
    handleLike,
    handleDislike,
    handleBanger,
  ]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col  justify-center w-full mt-10 gap-4 h-full outline-none"
      tabIndex={0}
    >
      <div className="flex flex-row justify-between  text-center p-6">

        <div className="text-xl text-foreground flex flex-row gap-4">
          <span className='font-bold capitalize'>
            Liked: {trackData?.likedCount ?? 0}{' '}
          </span>
          <span className='font-bold capitalize'>
            Bangers: {trackData?.bangerCount ?? 0}{' '}
          </span>
          <span className='font-bold capitalize'>
            Disliked: {trackData?.dislikedCount ?? 0}{' '}
          </span>
          <span className='font-bold capitalize'>
            Remaining: {trackData?.remainingCount ?? 0}{' '}
          </span>
        </div>
        <UsageTooltip />

      </div>
      <div className="flex flex-row justify-center mb-8 text-center h-full w-full">
        <SwipeView
          track={track || null}
          isLoading={isLoading}
          onLike={handleLike}
          onDislike={handleDislike}
          onBanger={handleBanger}
          onSwipeComplete={handleSwipeComplete}
          triggerSwipeDirection={triggerSwipeDirection}
        />
      </div>

    </div>
  );
}
