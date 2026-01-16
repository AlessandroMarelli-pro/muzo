import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useYouTubeAuth } from '@/services/playlist-hooks';
import { Youtube } from 'lucide-react';
import { useState } from 'react';

interface YouTubeSyncProps {
  onSync: () => Promise<{
    success: boolean;
    syncedCount: number;
    skippedCount: number;
    errors: string[];
    playlistUrl?: string | null;
  }>;
  disabled?: boolean;
}

export function YouTubeSync({ onSync, disabled = false }: YouTubeSyncProps) {
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const { getAuthUrl, authenticate, isGettingAuthUrl, isAuthenticating } =
    useYouTubeAuth('default');

  const handleSync = async () => {
    if (disabled || isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await onSync();
      if (result.success) {
        if (result.playlistUrl) {
          window.open(result.playlistUrl, '_blank');
        }
        alert(
          `Successfully synced ${result.syncedCount} tracks to YouTube!${
            result.skippedCount > 0
              ? ` ${result.skippedCount} tracks were skipped.`
              : ''
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
          await handleStartAuth();
        } else {
          alert(`Failed to sync playlist. Errors: ${result.errors.join(', ')}`);
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
        await handleStartAuth();
      } else {
        alert(`Failed to sync playlist to YouTube: ${errorMessage}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStartAuth = async () => {
    try {
      console.log('Getting YouTube auth URL...');
      const url = await getAuthUrl();
      console.log('YouTube auth URL received:', url);
      if (!url) {
        throw new Error('No authorization URL received');
      }
      setAuthUrl(url);
      setIsAuthDialogOpen(true);
      console.log('Auth dialog should be open now');
    } catch (error: any) {
      console.error('Failed to get auth URL:', error);
      const errorMsg =
        error?.message ||
        error?.response?.errors?.[0]?.message ||
        'Unknown error';
      alert(
        `Failed to get authentication URL: ${errorMsg}. Please check your backend configuration.`,
      );
    }
  };

  const handleCompleteAuth = async () => {
    if (!authCode.trim()) {
      alert('Please enter the authorization code');
      return;
    }

    try {
      const result = await authenticate(authCode);
      if (result.success) {
        setIsAuthDialogOpen(false);
        setAuthCode('');
        setAuthUrl(null);
        alert('Successfully authenticated with YouTube! Retrying sync...');
        // Retry the sync
        setTimeout(() => {
          handleSync();
        }, 500);
      } else {
        alert(`Authentication failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Failed to authenticate:', error);
      alert(`Failed to authenticate: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <>
      <DropdownMenuItem onClick={handleSync} disabled={disabled || isSyncing}>
        <Youtube className="h-4 w-4 mr-2" />
        {isSyncing ? 'Syncing...' : 'Sync to YouTube'}
      </DropdownMenuItem>

      {/* YouTube Authentication Dialog */}
      <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authenticate with YouTube</DialogTitle>
            <DialogDescription>
              To sync playlists to YouTube, you need to authenticate first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                1. Click the button below to open YouTube authorization page
              </p>
              {authUrl ? (
                <>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('Opening auth URL:', authUrl);
                      const newWindow = window.open(
                        authUrl,
                        '_blank',
                        'noopener,noreferrer',
                      );
                      if (!newWindow || newWindow.closed) {
                        alert(
                          'Popup blocked. Please click the link below to open the authorization page.',
                        );
                      }
                    }}
                    disabled={isGettingAuthUrl}
                    className="w-full"
                    variant="outline"
                  >
                    {isGettingAuthUrl
                      ? 'Loading...'
                      : 'Open YouTube Authorization'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Or{' '}
                    <a
                      href={authUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:no-underline"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open(authUrl, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      click here to open in a new tab
                    </a>
                  </p>
                </>
              ) : (
                <Button disabled className="w-full" variant="outline">
                  {isGettingAuthUrl
                    ? 'Loading authorization URL...'
                    : 'No URL available'}
                </Button>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                2. After authorizing, copy the authorization code from the URL
                and paste it below
              </p>
              <Input
                placeholder="Enter authorization code"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                disabled={isAuthenticating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAuthDialogOpen(false);
                setAuthCode('');
                setAuthUrl(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCompleteAuth}
              disabled={!authCode.trim() || isAuthenticating}
            >
              {isAuthenticating
                ? 'Authenticating...'
                : 'Complete Authentication'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
