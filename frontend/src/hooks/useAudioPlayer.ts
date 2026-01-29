import { SimpleMusicTrack } from '@/__generated__/types';
import {
  usePauseTrack,
  usePlaybackState,
  usePlayTrack,
  useToggleFavorite,
} from '@/services/music-player-hooks';
import { useQueue } from '@/services/queue-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface AudioPlayerState {
  trackId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isFavorite: boolean;
}

export interface AudioPlayerActions {
  play: (trackId: string) => Promise<void>;
  pause: (trackId: string) => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  toggleFavorite: (trackId: string) => Promise<void>;
}

export interface UseAudioPlayerOptions {
  trackId?: string;
  currentTrack?: SimpleMusicTrack | null;
  setCurrentTrack?: (track: SimpleMusicTrack | null) => void;
}

export function useAudioPlayer(options: UseAudioPlayerOptions = {}) {
  const { trackId, currentTrack, setCurrentTrack } = options;

  // Get queue for next/previous functionality
  const { data: queueItems = [] } = useQueue();

  // Get server playback state
  const { data: playbackState } = usePlaybackState(trackId || '', {
    enabled: !!trackId,
  });

  // Local state - synced from server state
  const [localState, setLocalState] = useState<AudioPlayerState>({
    trackId: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    playbackRate: 1.0,
    isFavorite: false,
  });

  // Mutations
  const playMutation = usePlayTrack();
  const pauseMutation = usePauseTrack();
  const toggleFavoriteMutation = useToggleFavorite();

  // Track the last trackId we manually updated to prevent sync effect from overwriting
  const lastManualUpdateRef = useRef<{
    trackId: string;
    timestamp: number;
  } | null>(null);

  // Sync local state from server state, but don't overwrite recent manual updates
  useEffect(() => {
    if (playbackState) {
      const now = Date.now();
      const lastUpdate = lastManualUpdateRef.current;

      // If we manually updated this trackId recently (within 500ms), skip the sync
      // This prevents the query from overwriting our immediate state update when switching tracks
      if (
        lastUpdate &&
        lastUpdate.trackId === playbackState.trackId &&
        now - lastUpdate.timestamp < 500
      ) {
        return;
      }

      setLocalState({
        trackId: playbackState.trackId,
        isPlaying: playbackState.isPlaying,
        currentTime: playbackState.currentTime,
        duration: playbackState.duration,
        volume: playbackState.volume,
        playbackRate: playbackState.playbackRate,
        isFavorite: playbackState.isFavorite,
      });
    }
  }, [playbackState]);

  // Play action - always calls playTrack mutation
  const play = useCallback(
    async (trackId: string) => {
      try {
        // Call the mutation
        const result = await playMutation.mutateAsync({
          trackId,
          startTime: 0,
        });

        // Update local state immediately with the mutation result
        // This ensures the UI updates even if the query hasn't refetched yet
        if (result) {
          // Mark this as a manual update to prevent sync effect from overwriting
          lastManualUpdateRef.current = {
            trackId: result.trackId,
            timestamp: Date.now(),
          };

          setLocalState({
            trackId: result.trackId,
            isPlaying: result.isPlaying,
            currentTime: result.currentTime,
            duration: result.duration,
            volume: result.volume,
            playbackRate: result.playbackRate,
            isFavorite: result.isFavorite,
          });
        }
      } catch (error) {
        console.error('Failed to play track:', error);
      }
    },
    [playMutation],
  );

  // Pause action
  const pause = useCallback(
    async (trackId: string) => {
      try {
        await pauseMutation.mutateAsync(trackId);
      } catch (error) {
        console.error('Failed to pause track:', error);
      }
    },
    [pauseMutation],
  );

  // Next track - get next track from queue and play it
  const next = useCallback(async () => {
    if (!currentTrack || !setCurrentTrack || queueItems.length === 0) return;

    const currentIndex = queueItems.findIndex(
      (item) => item.track?.id === currentTrack.id,
    );

    if (currentIndex === -1 || currentIndex === queueItems.length - 1) {
      // Already at the end or track not in queue
      return;
    }

    const nextItem = queueItems[currentIndex + 1];
    if (nextItem?.track) {
      setCurrentTrack(nextItem.track as any);
      await play(nextItem.track.id);
    }
  }, [currentTrack, queueItems, setCurrentTrack, play]);

  // Previous track - get previous track from queue and play it
  const previous = useCallback(async () => {
    if (!currentTrack || !setCurrentTrack || queueItems.length === 0) return;

    const currentIndex = queueItems.findIndex(
      (item) => item.track?.id === currentTrack.id,
    );

    if (currentIndex <= 0) {
      // Already at the beginning or track not in queue
      return;
    }

    const previousItem = queueItems[currentIndex - 1];
    if (previousItem?.track) {
      setCurrentTrack(previousItem.track as any);
      await play(previousItem.track.id);
    }
  }, [currentTrack, queueItems, setCurrentTrack, play]);

  // Toggle favorite
  const toggleFavorite = useCallback(
    async (trackId: string) => {
      try {
        const result = await toggleFavoriteMutation.mutateAsync(trackId);
        // Update local state with new favorite status
        setLocalState((prev) => ({
          ...prev,
          isFavorite: result.isFavorite,
        }));
      } catch (error) {
        console.error('Failed to toggle favorite:', error);
      }
    },
    [toggleFavoriteMutation],
  );

  const actions: AudioPlayerActions = useMemo(
    () => ({
      play,
      pause,
      next,
      previous,
      toggleFavorite,
    }),
    [play, pause, next, previous, toggleFavorite],
  );

  return useMemo(
    () => ({
      state: localState,
      actions,
    }),
    [localState, actions],
  );
}
