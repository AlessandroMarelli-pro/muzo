import {
  usePauseTrack,
  usePlaybackState,
  usePlayTrack,
  useResumeTrack,
  useSeekTrack,
  useSetPlaybackRate,
  useSetVolume,
  useStopTrack,
  useToggleFavorite,
} from '@/services/music-player-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMusicPlayerWebSocket } from './useMusicPlayerWebSocket';

export interface AudioPlayerState {
  trackId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isLoading: boolean;
  error: Error | null;
  isFavorite: boolean;
}

export interface AudioPlayerActions {
  play: (trackId: string, startTime?: number) => Promise<void>;
  pause: (trackId: string) => Promise<void>;
  resume: (trackId: string) => Promise<void>;
  seek: (trackId: string, timeInSeconds: number) => Promise<void>;
  stop: (trackId: string) => Promise<void>;
  setVolume: (trackId: string, volume: number) => Promise<void>;
  setPlaybackRate: (trackId: string, rate: number) => Promise<void>;
  togglePlayPause: (trackId: string) => Promise<void>;
  toggleFavorite: (trackId: string) => Promise<void>;
}

export interface UseAudioPlayerOptions {
  trackId?: string;
  autoPlay?: boolean;
  onStateChange?: (state: AudioPlayerState) => void;
  onError?: (error: Error) => void;
}

export function useAudioPlayer(options: UseAudioPlayerOptions = {}) {
  const { trackId, onStateChange, onError } = options;
  const onStateChangeRef = useRef(onStateChange);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // WebSocket connection for real-time updates
  const { isConnected: isWebSocketConnected } = useMusicPlayerWebSocket({
    trackId,
    onPlaybackStateUpdate: (playbackState) => {
      console.log('playbackState update', playbackState);
      const newState: AudioPlayerState = {
        trackId: playbackState.trackId,
        isPlaying: playbackState.isPlaying,
        currentTime: playbackState.currentTime,
        duration: playbackState.duration,
        volume: playbackState.volume,
        playbackRate: playbackState.playbackRate,
        isFavorite: playbackState.isFavorite,
        isLoading: false,
        error: null,
      };

      setLocalState(newState);
      onStateChangeRef.current?.(newState);
    },
    onPlaybackStopped: (stoppedTrackId) => {
      if (stoppedTrackId === trackId) {
        setLocalState((prev) => ({
          ...prev,
          isPlaying: false,
          currentTime: 0,
          isLoading: false,
        }));
      }
    },
  });

  const [localState, setLocalState] = useState<AudioPlayerState>({
    trackId: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.5,
    playbackRate: 1.0,
    isLoading: false,
    error: null,
    isFavorite: false,
  });

  // Use existing hooks - only for initial state when WebSocket is not connected
  const { data: playbackState, isLoading: isQueryLoading } = usePlaybackState(
    trackId || '',
    {
      enabled: !isWebSocketConnected && !!trackId,
    },
  );

  // Use existing mutation hooks
  const playMutation = usePlayTrack();
  const pauseMutation = usePauseTrack();
  const resumeMutation = useResumeTrack();
  const seekMutation = useSeekTrack();
  const stopMutation = useStopTrack();
  const setVolumeMutation = useSetVolume();
  const setPlaybackRateMutation = useSetPlaybackRate();
  const toggleFavoriteMutation = useToggleFavorite();

  // Update local state when server state changes (fallback when WebSocket is not connected)
  useEffect(() => {
    if (playbackState && !isWebSocketConnected) {
      const newState: AudioPlayerState = {
        trackId: playbackState.trackId,
        isPlaying: playbackState.isPlaying,
        currentTime: playbackState.currentTime,
        duration: playbackState.duration,
        volume: playbackState.volume,
        playbackRate: playbackState.playbackRate,
        isLoading: false,
        error: null,
        isFavorite: playbackState.isFavorite,
      };

      setLocalState(newState);
      onStateChangeRef.current?.(newState);
    }
  }, [playbackState, isWebSocketConnected]);

  // Reset state when trackId changes
  useEffect(() => {
    if (trackId && localState.trackId !== trackId) {
      setLocalState((prev) => ({
        ...prev,
        trackId,
        currentTime: 0,
        isPlaying: false,
        isLoading: false,
        error: null,
      }));
    }
  }, [trackId, localState.trackId]);

  // Update loading state
  useEffect(() => {
    const isLoading =
      playMutation.isPending ||
      pauseMutation.isPending ||
      resumeMutation.isPending ||
      seekMutation.isPending ||
      stopMutation.isPending ||
      setVolumeMutation.isPending ||
      setPlaybackRateMutation.isPending ||
      toggleFavoriteMutation.isPending ||
      isQueryLoading;

    setLocalState((prev) => ({ ...prev, isLoading }));
  }, [
    playMutation.isPending,
    pauseMutation.isPending,
    resumeMutation.isPending,
    seekMutation.isPending,
    stopMutation.isPending,
    setVolumeMutation.isPending,
    setPlaybackRateMutation.isPending,
    toggleFavoriteMutation.isPending,
    isQueryLoading,
  ]);

  // Actions
  const play = useCallback(
    async (trackId: string, startTime = 0) => {
      setLocalState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        await playMutation.mutateAsync({ trackId, startTime });
      } catch (error) {
        setLocalState((prev) => ({ ...prev, error: error as Error }));
        onErrorRef.current?.(error as Error);
      }
    },
    [playMutation],
  );

  const pause = useCallback(
    async (trackId: string) => {
      setLocalState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        await pauseMutation.mutateAsync(trackId);
      } catch (error) {
        setLocalState((prev) => ({ ...prev, error: error as Error }));
        onErrorRef.current?.(error as Error);
      }
    },
    [pauseMutation],
  );

  const resume = useCallback(
    async (trackId: string) => {
      setLocalState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        await resumeMutation.mutateAsync(trackId);
      } catch (error) {
        setLocalState((prev) => ({ ...prev, error: error as Error }));
        onErrorRef.current?.(error as Error);
      }
    },
    [resumeMutation],
  );

  const seek = useCallback(
    async (trackId: string, timeInSeconds: number) => {
      setLocalState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        await seekMutation.mutateAsync({ trackId, timeInSeconds });
      } catch (error) {
        setLocalState((prev) => ({ ...prev, error: error as Error }));
        onErrorRef.current?.(error as Error);
      }
    },
    [seekMutation],
  );

  const stop = useCallback(
    async (trackId: string) => {
      setLocalState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        await stopMutation.mutateAsync(trackId);
      } catch (error) {
        setLocalState((prev) => ({ ...prev, error: error as Error }));
        onErrorRef.current?.(error as Error);
      }
    },
    [stopMutation],
  );

  const setVolume = useCallback(
    async (trackId: string, volume: number) => {
      setLocalState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        await setVolumeMutation.mutateAsync({ trackId, volume });
      } catch (error) {
        setLocalState((prev) => ({ ...prev, error: error as Error }));
        onErrorRef.current?.(error as Error);
      }
    },
    [setVolumeMutation],
  );

  const setPlaybackRate = useCallback(
    async (trackId: string, rate: number) => {
      setLocalState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        await setPlaybackRateMutation.mutateAsync({ trackId, rate });
      } catch (error) {
        setLocalState((prev) => ({ ...prev, error: error as Error }));
        onErrorRef.current?.(error as Error);
      }
    },
    [setPlaybackRateMutation],
  );

  const togglePlayPause = useCallback(
    async (trackId: string) => {
      setLocalState((prev) => {
        if (prev.isPlaying && prev.trackId === trackId) {
          pause(trackId);
        } else {
          play(trackId, prev.currentTime);
        }
        return prev; // Don't update state here, let the server response handle it
      });
    },
    [play, pause],
  );

  const toggleFavorite = useCallback(
    async (trackId: string) => {
      setLocalState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const result = await toggleFavoriteMutation.mutateAsync(trackId);
        console.log('result', result);
        setLocalState((prev) => ({
          ...prev,
          isFavorite: result.isFavorite,
          isLoading: false,
        }));
      } catch (error) {
        setLocalState((prev) => ({ ...prev, error: error as Error }));
        onErrorRef.current?.(error as Error);
      }
    },
    [toggleFavoriteMutation],
  );

  const actions: AudioPlayerActions = useMemo(
    () => ({
      play,
      pause,
      resume,
      seek,
      stop,
      setVolume,
      setPlaybackRate,
      togglePlayPause,
      toggleFavorite,
    }),
    [
      play,
      pause,
      resume,
      seek,
      stop,
      setVolume,
      setPlaybackRate,
      togglePlayPause,
      toggleFavorite,
    ],
  );

  const mutations = useMemo(
    () => ({
      play: playMutation,
      pause: pauseMutation,
      resume: resumeMutation,
      seek: seekMutation,
      stop: stopMutation,
      setVolume: setVolumeMutation,
      setPlaybackRate: setPlaybackRateMutation,
      toggleFavorite: toggleFavoriteMutation,
    }),
    [
      playMutation,
      pauseMutation,
      resumeMutation,
      seekMutation,
      stopMutation,
      setVolumeMutation,
      setPlaybackRateMutation,
      toggleFavoriteMutation,
    ],
  );

  return useMemo(
    () => ({
      state: localState,
      actions,
      mutations,
      isWebSocketConnected,
    }),
    [localState, actions, mutations, isWebSocketConnected],
  );
}
