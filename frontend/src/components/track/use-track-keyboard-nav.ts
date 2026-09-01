import { Track } from '@/__generated__/types';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { isTypingTarget } from '@/lib/keyboard';
import * as React from 'react';

interface TrackKeyboardNavOptions {
  /** Rows in current display order. */
  tracks: Track[];
  onPreviousPage: () => void;
  onNextPage: () => void;
}

/**
 * Global single-key nav for a list of tracks: arrows / z-q-s-d (AZERTY WASD)
 * step the playing track up and down and page left / right. Ignored while the
 * user is typing or inside a popover. Shared by the card and table views.
 */
export function useTrackKeyboardNav({
  tracks,
  onPreviousPage,
  onNextPage,
}: TrackKeyboardNavOptions) {
  const actions = useAudioPlayerActions();
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const isPlaying = useIsPlaying();

  const playRow = React.useCallback(
    (track: Track) => {
      if (currentTrack?.id !== track.id) {
        setCurrentTrack(track);
        actions.play(track.id);
      } else if (!isPlaying) {
        actions.play(track.id);
      }
    },
    [actions, currentTrack, isPlaying, setCurrentTrack],
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'z', 'q', 's', 'd'].includes(event.key)) {
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (tracks.length === 0) return;

      switch (event.key) {
        case 'q':
        case 'ArrowLeft':
          event.preventDefault();
          onPreviousPage();
          break;
        case 'd':
        case 'ArrowRight':
          event.preventDefault();
          onNextPage();
          break;
        case 'z':
        case 's':
        case 'ArrowUp':
        case 'ArrowDown': {
          event.preventDefault();
          const currentIndex = tracks.findIndex((track) => track.id === currentTrack?.id);
          const delta = ['ArrowDown', 's'].includes(event.key) ? 1 : -1;
          const nextIndex =
            currentIndex === -1
              ? 0
              : Math.min(Math.max(currentIndex + delta, 0), tracks.length - 1);
          playRow(tracks[nextIndex]);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tracks, currentTrack?.id, playRow, onPreviousPage, onNextPage]);
}
