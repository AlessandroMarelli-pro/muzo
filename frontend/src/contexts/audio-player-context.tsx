import { SimpleMusicTrack } from '@/__generated__/types';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

// Separate contexts to prevent unnecessary re-renders
const CurrentTrackContext = createContext<{
  currentTrack: SimpleMusicTrack | null;
  setCurrentTrack: (track: SimpleMusicTrack | null) => void;
} | null>(null);

const IsPlayingContext = createContext<boolean>(false);

const AudioPlayerStateContext = createContext<
  ReturnType<typeof useAudioPlayer>['state'] | null
>(null);

const QueueContext = createContext<{
  queue: SimpleMusicTrack[] | null;
  setQueue: (queue: SimpleMusicTrack[] | null) => void;
} | null>(null);

const AudioPlayerActionsContext = createContext<
  ReturnType<typeof useAudioPlayer>['actions'] | null
>(null);

interface AudioPlayerProviderProps {
  children: ReactNode;
}

export function AudioPlayerProvider({ children }: AudioPlayerProviderProps) {
  const [currentTrack, setCurrentTrack] = useState<SimpleMusicTrack | null>(
    null,
  );
  const [queue, setQueue] = useState<SimpleMusicTrack[] | null>(null);
  const { state, actions } = useAudioPlayer({
    trackId: currentTrack?.id || undefined,
  });

  const currentTrackValue = useMemo(
    () => ({
      currentTrack,
      setCurrentTrack,
    }),
    [currentTrack],
  );

  const currentQueueValue = useMemo(
    () => ({
      queue,
      setQueue,
    }),
    [queue],
  );

  return (
    <QueueContext.Provider value={currentQueueValue}>
      <CurrentTrackContext.Provider value={currentTrackValue}>
        <IsPlayingContext.Provider value={state.isPlaying}>
          <AudioPlayerStateContext.Provider value={state}>
            <AudioPlayerActionsContext.Provider value={actions}>
              {children}
            </AudioPlayerActionsContext.Provider>
          </AudioPlayerStateContext.Provider>
        </IsPlayingContext.Provider>
      </CurrentTrackContext.Provider>
    </QueueContext.Provider>
  );
}

export function useCurrentTrack() {
  const context = useContext(CurrentTrackContext);
  if (!context) {
    throw new Error(
      'useCurrentTrack must be used within an AudioPlayerProvider',
    );
  }
  return context;
}

export function useIsPlaying() {
  return useContext(IsPlayingContext);
}

export function useQueue() {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within an AudioPlayerProvider');
  }
  return context;
}
export function useAudioPlayerActions() {
  const context = useContext(AudioPlayerActionsContext);
  if (!context) {
    throw new Error(
      'useAudioPlayerActions must be used within an AudioPlayerProvider',
    );
  }
  return context;
}

export function useAudioPlayerState() {
  const context = useContext(AudioPlayerStateContext);
  if (!context) {
    throw new Error(
      'useAudioPlayerState must be used within an AudioPlayerProvider',
    );
  }
  return context;
}

// Legacy hook for backward compatibility
export function useAudioPlayerContext() {
  const currentTrack = useCurrentTrack();
  const state = useAudioPlayerState();
  const actions = useAudioPlayerActions();

  return {
    ...currentTrack,
    state,
    actions,
  };
}
