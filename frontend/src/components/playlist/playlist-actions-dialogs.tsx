import { Playlist } from '@/__generated__/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PlaylistActions } from '@/services/use-playlist-actions';
import { MergePlaylistsDialog } from './merge-playlists-dialog';
import { PlaylistHqBatchDownloadDialog } from './playlist-hq-batch-download-dialog';

interface PlaylistActionsDialogsProps {
  playlist: Playlist | undefined;
  actions: PlaylistActions;
  /** Called after the HQ batch-download dialog closes (e.g. to refetch). */
  onHqDialogClosed?: () => void;
}

/**
 * All the confirm dialogs the playlist actions menu can open, driven by
 * `actions.confirm` / `actions.hqDownloadOpen`. Mount once per menu instance.
 */
export function PlaylistActionsDialogs({
  playlist,
  actions,
  onHqDialogClosed,
}: PlaylistActionsDialogsProps) {
  const { confirm, setConfirm, pending, queueCount } = actions;
  const name = playlist?.name ?? 'this playlist';

  return (
    <>
      <AlertDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this playlist?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{name}</span> will be permanently
              removed. Your tracks stay in your library — only the playlist is deleted. This
              can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending.delete}>Keep playlist</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void actions.confirmDelete();
              }}
              disabled={pending.delete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending.delete ? 'Deleting…' : 'Delete playlist'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirm === 'rescan'}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force re-scan all tracks?</AlertDialogTitle>
            <AlertDialogDescription>
              Every track in <span className="font-medium text-foreground">{name}</span> will be
              re-analysed (DSP). This runs in the background and can take a while.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending.rescan}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void actions.confirmRescan();
              }}
              disabled={pending.rescan}
            >
              {pending.rescan ? 'Scheduling…' : 'Re-scan tracks'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirm === 'replaceQueue'}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your current queue?</AlertDialogTitle>
            <AlertDialogDescription>
              Your queue has {queueCount} {queueCount === 1 ? 'track' : 'tracks'} in it. Loading
              this playlist will clear it and start from the top.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending.replaceQueue}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void actions.replaceQueue();
              }}
              disabled={pending.replaceQueue}
            >
              {pending.replaceQueue ? 'Replacing…' : 'Replace queue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PlaylistHqBatchDownloadDialog
        playlist={playlist}
        open={actions.hqDownloadOpen}
        onOpenChange={(nextOpen) => {
          actions.setHqDownloadOpen(nextOpen);
          if (!nextOpen) onHqDialogClosed?.();
        }}
      />

      <MergePlaylistsDialog
        playlist={playlist}
        open={actions.mergeOpen}
        onOpenChange={actions.setMergeOpen}
      />
    </>
  );
}
