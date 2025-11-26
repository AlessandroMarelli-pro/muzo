import { PlaybackState } from '@/services/music-player-hooks';
import { musicPlayerWebSocket } from '@/services/music-player-websocket';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseMusicPlayerWebSocketOptions {
  trackId?: string;
  onPlaybackStateUpdate?: (playbackState: PlaybackState) => void;
  onPlaybackStopped?: (trackId: string) => void;
  autoConnect?: boolean;
}

export function useMusicPlayerWebSocket(
  options: UseMusicPlayerWebSocketOptions = {},
) {
  const {
    trackId,
    onPlaybackStateUpdate,
    onPlaybackStopped,
    autoConnect = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const [subscribedTrackId, setSubscribedTrackId] = useState<string | null>(
    null,
  );

  const onPlaybackStateUpdateRef = useRef(onPlaybackStateUpdate);
  const onPlaybackStoppedRef = useRef(onPlaybackStopped);

  // Update refs when callbacks change
  useEffect(() => {
    onPlaybackStateUpdateRef.current = onPlaybackStateUpdate;
  }, [onPlaybackStateUpdate]);

  useEffect(() => {
    onPlaybackStoppedRef.current = onPlaybackStopped;
  }, [onPlaybackStopped]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    try {
      setConnectionError(null);
      await musicPlayerWebSocket.connect();
      setIsConnected(true);
    } catch (error) {
      setConnectionError(error as Error);
      setIsConnected(false);
    }
  }, []);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    musicPlayerWebSocket.disconnect();
    setIsConnected(false);
    setSubscribedTrackId(null);
  }, []);

  // Subscribe to track updates
  const subscribeToTrack = useCallback(
    (newTrackId: string) => {
      if (!isConnected) {
        console.warn('Cannot subscribe to track: WebSocket not connected');
        return;
      }

      // Unsubscribe from previous track if any
      if (subscribedTrackId && subscribedTrackId !== newTrackId) {
        musicPlayerWebSocket.unsubscribeFromTrack(subscribedTrackId);
      }

      musicPlayerWebSocket.subscribeToTrack(newTrackId);
      setSubscribedTrackId(newTrackId);
    },
    [isConnected, subscribedTrackId],
  );

  // Unsubscribe from track updates
  const unsubscribeFromTrack = useCallback(
    (trackIdToUnsubscribe: string) => {
      if (!isConnected) {
        console.warn('Cannot unsubscribe from track: WebSocket not connected');
        return;
      }

      musicPlayerWebSocket.unsubscribeFromTrack(trackIdToUnsubscribe);

      if (subscribedTrackId === trackIdToUnsubscribe) {
        setSubscribedTrackId(null);
      }
    },
    [isConnected, subscribedTrackId],
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      if (subscribedTrackId) {
        musicPlayerWebSocket.unsubscribeFromTrack(subscribedTrackId);
      }
      disconnect();
    };
  }, [autoConnect, connect, disconnect, subscribedTrackId]);

  // Subscribe to track when trackId changes
  useEffect(() => {
    if (trackId && isConnected) {
      subscribeToTrack(trackId);
    } else if (!trackId && subscribedTrackId) {
      unsubscribeFromTrack(subscribedTrackId);
    }
  }, [
    trackId,
    isConnected,
    subscribeToTrack,
    unsubscribeFromTrack,
    subscribedTrackId,
  ]);

  // Set up event listeners
  useEffect(() => {
    if (!isConnected) return;

    const handlePlaybackStateUpdate = (playbackState: PlaybackState) => {
      onPlaybackStateUpdateRef.current?.(playbackState);
    };

    const handlePlaybackStopped = (stoppedTrackId: string) => {
      onPlaybackStoppedRef.current?.(stoppedTrackId);
    };

    const handleSubscriptionConfirmed = (confirmedTrackId: string) => {
      console.log(`Subscribed to track ${confirmedTrackId} updates`);
    };

    const handleUnsubscriptionConfirmed = (unsubscribedTrackId: string) => {
      console.log(`Unsubscribed from track ${unsubscribedTrackId} updates`);
    };

    musicPlayerWebSocket.onPlaybackStateUpdate(handlePlaybackStateUpdate);
    musicPlayerWebSocket.onPlaybackStopped(handlePlaybackStopped);
    musicPlayerWebSocket.onSubscriptionConfirmed(handleSubscriptionConfirmed);
    musicPlayerWebSocket.onUnsubscriptionConfirmed(
      handleUnsubscriptionConfirmed,
    );

    return () => {
      musicPlayerWebSocket.offPlaybackStateUpdate(handlePlaybackStateUpdate);
      musicPlayerWebSocket.offPlaybackStopped(handlePlaybackStopped);
      musicPlayerWebSocket.offSubscriptionConfirmed(
        handleSubscriptionConfirmed,
      );
      musicPlayerWebSocket.offUnsubscriptionConfirmed(
        handleUnsubscriptionConfirmed,
      );
    };
  }, [isConnected]);

  return {
    isConnected,
    connectionError,
    subscribedTrackId,
    connect,
    disconnect,
    subscribeToTrack,
    unsubscribeFromTrack,
  };
}
