import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Playback position, published by the docked music player and read by any
 * surface that wants a progress readout or a seek control of its own (e.g. the
 * add-track panel, which sits above the player bar). The player owns the
 * `<audio>` element; this context is a thin one-way mirror of its position
 * plus a `seek` callback the player registers.
 */
interface PlaybackProgress {
  /** Track currently loaded in the player, or null. */
  trackId: string | null;
  /** Seconds elapsed. */
  currentTime: number;
  /** Track length in seconds (0 until known). */
  duration: number;
  /** Seek the loaded track to `seconds`. No-op when nothing is playing. */
  seek: (seconds: number) => void;
}

const PlaybackProgressContext = createContext<PlaybackProgress | null>(null);

/** Internal setters, used only by the player to push updates in. */
interface PlaybackProgressPublisher {
  setProgress: (next: { trackId: string | null; currentTime: number; duration: number }) => void;
  registerSeek: (fn: (seconds: number) => void) => void;
}
const PlaybackProgressPublisherContext = createContext<PlaybackProgressPublisher | null>(null);

export function PlaybackProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    trackId: string | null;
    currentTime: number;
    duration: number;
  }>({ trackId: null, currentTime: 0, duration: 0 });
  const seekRef = useRef<(seconds: number) => void>(() => {});

  const publisher = useMemo<PlaybackProgressPublisher>(
    () => ({
      setProgress: (next) => setState(next),
      registerSeek: (fn) => {
        seekRef.current = fn;
      },
    }),
    [],
  );

  const value = useMemo<PlaybackProgress>(
    () => ({
      ...state,
      seek: (seconds) => seekRef.current(seconds),
    }),
    [state],
  );

  return (
    <PlaybackProgressPublisherContext.Provider value={publisher}>
      <PlaybackProgressContext.Provider value={value}>{children}</PlaybackProgressContext.Provider>
    </PlaybackProgressPublisherContext.Provider>
  );
}

/** Read playback position + seek. Returns null outside the provider. */
export function usePlaybackProgress() {
  return useContext(PlaybackProgressContext);
}

/** Player-only: push position updates and register the seek handler. */
export function usePlaybackProgressPublisher() {
  const ctx = useContext(PlaybackProgressPublisherContext);
  if (!ctx) {
    throw new Error(
      'usePlaybackProgressPublisher must be used within a PlaybackProgressProvider',
    );
  }
  return ctx;
}
