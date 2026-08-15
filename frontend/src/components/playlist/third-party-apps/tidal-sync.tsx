import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Music } from 'lucide-react';
import { forwardRef, useImperativeHandle, useState } from 'react';

export interface TidalSyncHandle {
  retrySync: () => void;
}

interface TidalSyncProps {
  onSync: () => Promise<{
    success: boolean;
    syncedCount: number;
    skippedCount: number;
    errors: string[];
    playlistUrl?: string | null;
  }>;
  // Dialog state must be owned outside the DropdownMenu: Radix unmounts
  // DropdownMenuContent's children once the menu closes, which would
  // destroy this component's local state before an async auth flow
  // (triggered from the menu item) can open its own dialog.
  onNeedAuth: () => void;
  disabled?: boolean;
}

export const TidalSync = forwardRef<TidalSyncHandle, TidalSyncProps>(function TidalSync(
  { onSync, onNeedAuth, disabled = false },
  ref,
) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (disabled || isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await onSync();
      if (result.success) {
        alert(
          `Successfully synced playlist to TIDAL!\n\nSynced: ${result.syncedCount} tracks\nSkipped: ${result.skippedCount} tracks${
            result.playlistUrl ? `\n\nPlaylist URL: ${result.playlistUrl}` : ''
          }${result.errors.length > 0 ? `\n\nErrors:\n${result.errors.join('\n')}` : ''}`,
        );
      } else {
        const errorMessages = result.errors.join(' ').toLowerCase();
        const isAuthError =
          errorMessages.includes('not authenticated') ||
          errorMessages.includes('unauthorized') ||
          errorMessages.includes('authorize') ||
          errorMessages.includes('authentication') ||
          errorMessages.includes('tidal not authenticated') ||
          errorMessages.includes('please authorize');

        if (isAuthError) {
          onNeedAuth();
        } else {
          alert(`Failed to sync playlist to TIDAL: ${result.errors.join(', ')}`);
        }
      }
    } catch (error: any) {
      console.error('Failed to sync playlist to TIDAL:', error);

      const errorMessage =
        error?.message ||
        error?.response?.errors?.[0]?.message ||
        error?.errors?.[0]?.message ||
        error?.toString() ||
        JSON.stringify(error);

      const isAuthError =
        errorMessage.includes('not authenticated') ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('authorize') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('TIDAL not authenticated');

      if (isAuthError) {
        onNeedAuth();
      } else {
        alert(`Failed to sync playlist to TIDAL: ${errorMessage}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  useImperativeHandle(ref, () => ({ retrySync: handleSync }));

  return (
    <DropdownMenuItem onClick={handleSync} disabled={disabled || isSyncing}>
      <Music className="h-4 w-4 mr-2" />
      {isSyncing ? 'Syncing…' : 'Sync to TIDAL'}
    </DropdownMenuItem>
  );
});
