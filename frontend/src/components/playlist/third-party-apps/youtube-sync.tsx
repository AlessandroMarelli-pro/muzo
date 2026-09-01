import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Youtube } from 'lucide-react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { toast } from 'sonner';

export interface YouTubeSyncHandle {
  retrySync: () => void;
}

interface YouTubeSyncProps {
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

export const YouTubeSync = forwardRef<YouTubeSyncHandle, YouTubeSyncProps>(function YouTubeSync(
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
        if (result.playlistUrl) {
          window.open(result.playlistUrl, '_blank');
        }
        toast.success(
          `Synced ${result.syncedCount} tracks to YouTube${
            result.skippedCount > 0 ? ` · ${result.skippedCount} skipped` : ''
          }`,
        );
      } else {
        // Check if any error is an authentication error
        const errorMessages = result.errors.join(' ');
        const isAuthError =
          errorMessages.includes('not authenticated') ||
          errorMessages.includes('Unauthorized') ||
          errorMessages.includes('authorize') ||
          errorMessages.includes('authentication') ||
          errorMessages.includes('YouTube not authenticated');

        if (isAuthError) {
          onNeedAuth();
        } else {
          toast.error(`Couldn't sync to YouTube: ${result.errors.join(', ')}`);
        }
      }
    } catch (error: any) {
      console.error('Failed to sync playlist to YouTube:', error);

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
        errorMessage.includes('YouTube not authenticated');

      if (isAuthError) {
        onNeedAuth();
      } else {
        toast.error(`Couldn't sync to YouTube: ${errorMessage}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  useImperativeHandle(ref, () => ({ retrySync: handleSync }));

  return (
    <DropdownMenuItem onClick={handleSync} disabled={disabled || isSyncing}>
      <Youtube className="h-4 w-4 mr-2" />
      {isSyncing ? 'Syncing…' : 'Sync to YouTube'}
    </DropdownMenuItem>
  );
});
