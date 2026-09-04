import { Playlist } from '@/__generated__/types';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import {
  useDeletePlaylist,
  useDownloadPlaylistToFolder,
  useExportPlaylistToM3U,
  useScanPlaylistTracks,
} from '@/services/playlist-hooks';
import { useAddTracksToQueue, useQueue, useRemoveTrackFromQueue } from '@/services/queue-hooks';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

/**
 * Actions that need a confirmation step before they run. Mirrors the
 * `ConfirmKind` pattern in `track/track-more-menu.tsx`.
 */
export type PlaylistConfirmKind = 'delete' | 'rescan' | 'replaceQueue' | null;

export interface UsePlaylistActionsOptions {
  /** Called after a playlist is successfully deleted (navigate away / refetch). */
  onDeleted?: () => void;
  /** Called after any mutation that changes playlist contents settles. */
  onChanged?: () => void;
}

/**
 * Every playlist-level action, in one place, shared by the playlists-grid card
 * menu and the playlist-detail header menu.
 *
 * Opening a Radix dialog from inside a menu item — while the menu is still
 * closing — makes the two primitives fight over `document.body`'s
 * `pointer-events` / scroll lock, and the menu's cleanup can strand
 * `pointer-events: none` on the body permanently. Every action here that opens
 * a dialog is therefore deferred one tick past the menu's unmount via
 * `afterMenuCloses`; menu items must call these through `onSelect` (Radix
 * closes the menu on select) rather than `onClick`.
 */
export function usePlaylistActions(
  playlist: Playlist | undefined,
  { onDeleted, onChanged }: UsePlaylistActionsOptions = {},
) {
  const { setCurrentTrack } = useCurrentTrack();
  const playerActions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();

  const { data: currentQueue = [] } = useQueue();
  const addTracksToQueue = useAddTracksToQueue();
  const removeTrackFromQueue = useRemoveTrackFromQueue();

  const deletePlaylistMutation = useDeletePlaylist();
  const exportM3uMutation = useExportPlaylistToM3U();
  const copyFilesMutation = useDownloadPlaylistToFolder();
  const scanTracksMutation = useScanPlaylistTracks();

  const [confirm, setConfirm] = useState<PlaylistConfirmKind>(null);
  const [hqDownloadOpen, setHqDownloadOpen] = useState(false);
  const [isReplacingQueue, setIsReplacingQueue] = useState(false);
  const [isCopyingCsv, setIsCopyingCsv] = useState(false);

  const afterMenuCloses = useCallback(
    (fn: () => void) => () => window.setTimeout(fn, 0),
    [],
  );

  // ---- Playback ------------------------------------------------------------

  const playFromTop = useCallback(() => {
    const first = playlist?.tracks?.[0]?.track;
    if (!first) return;
    setCurrentTrack(first);
    playerActions.play(first.id || '');
  }, [playlist?.tracks, setCurrentTrack, playerActions]);

  const replaceQueue = useCallback(async () => {
    if (!playlist) return;
    setIsReplacingQueue(true);
    try {
      // Clear the existing queue (per-item failures are non-fatal).
      await Promise.all(
        currentQueue.map((item) =>
          removeTrackFromQueue.mutateAsync(item.trackId).catch((err) => {
            console.warn(`Failed to remove track ${item.trackId} from queue:`, err);
          }),
        ),
      );

      const trackIds =
        playlist.tracks?.filter((pt) => pt.track?.id).map((pt) => pt.track!.id) ?? [];
      await addTracksToQueue.mutateAsync(trackIds);

      const first = playlist.tracks?.[0]?.track;
      if (first) {
        setCurrentTrack(first);
        playerActions.play(first.id || '');
      }
      toast.success(`Queue replaced with “${playlist.name}”`);
    } catch (error) {
      console.error('Failed to set playlist as queue:', error);
      toast.error('Could not replace the queue. Please try again.');
    } finally {
      setIsReplacingQueue(false);
      setConfirm(null);
    }
  }, [playlist, currentQueue, removeTrackFromQueue, addTracksToQueue, setCurrentTrack, playerActions]);

  // Nothing to lose if the queue is empty — skip the confirmation.
  const requestReplaceQueue = useCallback(() => {
    if (currentQueue.length === 0) {
      void replaceQueue();
    } else {
      setConfirm('replaceQueue');
    }
  }, [currentQueue.length, replaceQueue]);

  // ---- Export -----------------------------------------------------------

  const exportM3u = useCallback(async () => {
    if (!playlist) return;
    try {
      const m3uContent = await exportM3uMutation.mutateAsync(playlist.id);
      const blob = new Blob([m3uContent], { type: 'audio/mpegurl' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${playlist.name.trim().replace(/\s+/g, '-').replace(/[^\w.-]/g, '')}.m3u`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Playlist exported as .m3u');
    } catch (error) {
      console.error('Failed to export playlist:', error);
      toast.error('Could not export the playlist. Please try again.');
    }
  }, [playlist, exportM3uMutation]);

  const copyFilesToFolder = useCallback(async () => {
    if (!playlist) return;
    try {
      const ok = await copyFilesMutation.mutateAsync(playlist.id);
      if (ok) {
        toast.success('Audio files copied to the server’s export folder.');
      } else {
        toast.error('Could not export the playlist.');
      }
    } catch (error) {
      console.error('Failed to export playlist:', error);
      toast.error('Could not export the playlist. Please try again.');
    }
  }, [playlist, copyFilesMutation]);

  const copyTracklistCsv = useCallback(async () => {
    if (!playlist?.tracks?.length) return;
    setIsCopyingCsv(true);
    const escapeCsvField = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [
      ['Artist', 'Title'],
      ...playlist.tracks.map((playlistTrack) => [
        playlistTrack.track?.artist || '',
        playlistTrack.track?.title || '',
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
    try {
      await navigator.clipboard.writeText(csv);
      toast.success('Tracklist copied to clipboard as CSV');
    } catch (error) {
      console.error('Failed to copy playlist:', error);
      toast.error('Could not copy the tracklist. Please try again.');
    } finally {
      setIsCopyingCsv(false);
    }
  }, [playlist]);

  const openHqBatchDownload = useCallback(() => setHqDownloadOpen(true), []);

  // ---- Maintenance -------------------------------------------------------

  const requestRescan = useCallback(() => setConfirm('rescan'), []);

  const confirmRescan = useCallback(async () => {
    if (!playlist) return;
    try {
      await scanTracksMutation.mutateAsync({ playlistId: playlist.id, force: true });
      onChanged?.();
    } catch (error) {
      // useScanPlaylistTracks already toasts on error.
      console.error('Failed to schedule playlist scan:', error);
    } finally {
      setConfirm(null);
    }
  }, [playlist, scanTracksMutation, onChanged]);

  // ---- Delete ----------------------------------------------------------

  const requestDelete = useCallback(() => setConfirm('delete'), []);

  const confirmDelete = useCallback(async () => {
    if (!playlist) return;
    try {
      await deletePlaylistMutation.mutateAsync({ id: playlist.id, name: playlist.name });
      setConfirm(null);
      onDeleted?.();
    } catch (error) {
      // useDeletePlaylist already toasts on error.
      console.error('Failed to delete playlist:', error);
    }
  }, [playlist, deletePlaylistMutation, onDeleted]);

  return {
    isPlaying,

    playFromTop,
    requestReplaceQueue,
    exportM3u,
    copyFilesToFolder,
    copyTracklistCsv,
    openHqBatchDownload,
    requestRescan,
    requestDelete,

    afterMenuCloses,

    confirm,
    setConfirm,
    confirmRescan,
    confirmDelete,
    replaceQueue,

    hqDownloadOpen,
    setHqDownloadOpen,

    queueCount: currentQueue.length,

    pending: {
      replaceQueue: isReplacingQueue,
      exportM3u: exportM3uMutation.isPending,
      copyFilesToFolder: copyFilesMutation.isPending,
      copyTracklistCsv: isCopyingCsv,
      rescan: scanTracksMutation.isPending,
      delete: deletePlaylistMutation.isPending,
    },
  };
}

export type PlaylistActions = ReturnType<typeof usePlaylistActions>;
