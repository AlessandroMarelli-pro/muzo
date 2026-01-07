'use client';

import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { useRandomTrack, useBangerTrack, useDislikeTrack, useLikeTrack } from '@/services/api-hooks';
import { SwipeView } from './swipe-track';
import { SwipeControls } from './swipe-controls';
import { useCallback, useEffect, useRef, useState } from 'react';

export function SwipePage() {
  const [trackId, setTrackId] = useState<string | undefined>(undefined);
  const { data: track, isLoading: isLoadingTrack, refetch } = useRandomTrack(trackId);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  
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
    setTrackId(undefined);
    refetch();
  }, [refetch]);

  // Auto-play next track if music was playing
  useEffect(() => {
    if (track && shouldAutoPlay && !isLoadingTrack) {
      setCurrentTrack(track);
      actions.togglePlayPause(track.id);
      setShouldAutoPlay(false);
    }
  }, [track, shouldAutoPlay, isLoadingTrack, setCurrentTrack, actions]);

  const handleLike = useCallback(async () => {
    if (!track) return;
    const wasPlaying = isPlaying && currentTrack?.id === track.id;
    try {
      await likeMutation.mutateAsync(track.id);
      if (wasPlaying) {
        setShouldAutoPlay(true);
      }
      handleSwipeComplete();
    } catch (error) {
      console.error('Error liking track:', error);
    }
  }, [track, likeMutation, handleSwipeComplete, isPlaying, currentTrack]);

  const handleDislike = useCallback(async () => {
    if (!track) return;
    try {
      await dislikeMutation.mutateAsync(track.id);
      handleSwipeComplete();
    } catch (error) {
      console.error('Error disliking track:', error);
    }
  }, [track, dislikeMutation, handleSwipeComplete]);

  const handleBanger = useCallback(async () => {
    if (!track) return;
    const wasPlaying = isPlaying && currentTrack?.id === track.id;
    try {
      await bangerMutation.mutateAsync(track.id);
      if (wasPlaying) {
        setShouldAutoPlay(true);
      }
      handleSwipeComplete();
    } catch (error) {
      console.error('Error banger track:', error);
    }
  }, [track, bangerMutation, handleSwipeComplete, isPlaying, currentTrack]);

  const isLoading = isLoadingTrack || likeMutation.isPending || bangerMutation.isPending || dislikeMutation.isPending;

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
        actions.togglePlayPause(track.id);
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
  }, [track, currentTrack, setCurrentTrack, actions, isLoading, handleLike, handleDislike, handleBanger]);

  return (
    <div
      ref={containerRef}
      className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen"
      tabIndex={0}
    >
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Filter Your Music</h1>
        <p className="text-muted-foreground">
          Swipe right to like, left to dislike, or up for BANGER!
        </p>
        <div className="text-sm text-muted-foreground mt-2 space-y-1">
          <p>
            <kbd className="px-2 py-1 bg-secondary rounded text-xs">Space</kbd> play/pause
          </p>
          <p>
            <kbd className="px-2 py-1 bg-secondary rounded text-xs">E</kbd> like •{' '}
            <kbd className="px-2 py-1 bg-secondary rounded text-xs">Z</kbd> banger •{' '}
            <kbd className="px-2 py-1 bg-secondary rounded text-xs">A</kbd> dislike
          </p>
        </div>
      </div>

      <SwipeView
        track={track || null}
        isLoading={isLoading}
        onLike={handleLike}
        onDislike={handleDislike}
        onBanger={handleBanger}
        onSwipeComplete={handleSwipeComplete}
      />

      <SwipeControls
        onLike={handleLike}
        onDislike={handleDislike}
        onBanger={handleBanger}
        disabled={isLoading || !track}
      />
    </div>
  );
}
