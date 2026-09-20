import { Track } from '@/__generated__/types';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useDislikeTrack } from '@/services/api-hooks';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

// Separate contexts to prevent unnecessary re-renders
const CurrentTrackContext = createContext<{
  currentTrack: Track | null;
  setCurrentTrack: (track: Track | null) => void;
} | null>(null);

const IsPlayingContext = createContext<boolean>(false);

const AudioPlayerStateContext = createContext<ReturnType<typeof useAudioPlayer>['state'] | null>(
  null,
);

const AudioPlayerActionsContext = createContext<
  ReturnType<typeof useAudioPlayer>['actions'] | null
>(null);

interface AudioPlayerProviderProps {
  children: ReactNode;
}

export function AudioPlayerProvider({ children }: AudioPlayerProviderProps) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const { state, actions } = useAudioPlayer({
    trackId: currentTrack?.id || undefined,
    currentTrack,
    setCurrentTrack,
  });

  const currentTrackValue = useMemo(
    () => ({
      currentTrack,
      setCurrentTrack,
    }),
    [currentTrack],
  );

  return (
    <CurrentTrackContext.Provider value={currentTrackValue}>
      <IsPlayingContext.Provider value={state.isPlaying}>
        <AudioPlayerStateContext.Provider value={state}>
          <AudioPlayerActionsContext.Provider value={actions}>
            {children}
          </AudioPlayerActionsContext.Provider>
        </AudioPlayerStateContext.Provider>
      </IsPlayingContext.Provider>
    </CurrentTrackContext.Provider>
  );
}

export function useCurrentTrack() {
  const context = useContext(CurrentTrackContext);
  if (!context) {
    throw new Error('useCurrentTrack must be used within an AudioPlayerProvider');
  }
  return context;
}

export function useIsPlaying() {
  return useContext(IsPlayingContext);
}

/** A track is unclassified once it plays with neither `isLiked` nor `isBanger` set. */
export function useTrackClassificationGate() {
  const { currentTrack } = useCurrentTrack();
  const isPlaying = useIsPlaying();
  const needsClassification =
    !!currentTrack && !currentTrack.isLiked && !currentTrack.isBanger;
  return { needsClassification: needsClassification && isPlaying };
}

export function useAudioPlayerActions() {
  const context = useContext(AudioPlayerActionsContext);
  if (!context) {
    throw new Error('useAudioPlayerActions must be used within an AudioPlayerProvider');
  }
  return context;
}

export function useAudioPlayerState() {
  const context = useContext(AudioPlayerStateContext);
  if (!context) {
    throw new Error('useAudioPlayerState must be used within an AudioPlayerProvider');
  }
  return context;
}

/**
 * Dislike removes the track from the library entirely (see ToggleDislikeUseCase
 * on the backend), so it can never keep playing or stay loaded — this advances
 * to the next queued track, or clears the player if there's nowhere to go.
 */
export function useDislikeCurrentTrack() {
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const dislikeMutation = useDislikeTrack();
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;

  const dislikeCurrentTrack = useCallback(
    (onError?: () => void) => {
      if (!currentTrack) return;
      const dislikedTrackId = currentTrack.id;
      dislikeMutation.mutate(dislikedTrackId, {
        onSuccess: async () => {
          await actions.next();
          if (currentTrackRef.current?.id === dislikedTrackId) {
            setCurrentTrack(null);
          }
        },
        onError,
      });
    },
    [currentTrack, dislikeMutation, actions, setCurrentTrack],
  );

  return { dislikeCurrentTrack, isPending: dislikeMutation.isPending };
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
