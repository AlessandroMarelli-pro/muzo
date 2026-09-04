import { Playlist } from '@/__generated__/types';
import { usePlaylistActions } from '@/services/use-playlist-actions';
import { PlaylistActionsDialogs } from './playlist-actions-dialogs';
import { PlaylistActionsMenu } from './playlist-actions-menu';

interface PlaylistDetailActionsProps {
  playlist: Playlist | undefined;
  isLoading: boolean;
  /** Navigate away once the playlist is deleted. */
  onDeleted: () => void;
  /** Refetch after playlist contents change (re-scan, HQ download). */
  onChanged: () => void;
}

export function PlaylistDetailActions({
  playlist,
  isLoading,
  onDeleted,
  onChanged,
}: PlaylistDetailActionsProps) {
  const actions = usePlaylistActions(playlist, { onDeleted, onChanged });

  return (
    <>
      <PlaylistActionsMenu
        playlist={isLoading ? undefined : playlist}
        actions={actions}
        variant="detail"
      />
      <PlaylistActionsDialogs
        playlist={playlist}
        actions={actions}
        onHqDialogClosed={onChanged}
      />
    </>
  );
}
