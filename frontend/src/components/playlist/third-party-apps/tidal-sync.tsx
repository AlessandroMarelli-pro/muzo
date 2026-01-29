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
import { useTidalAuth } from '@/services/playlist-hooks';
import { Music } from 'lucide-react';
import { useState } from 'react';

interface TidalSyncProps {
  onSync: () => Promise<{
    success: boolean;
    syncedCount: number;
    skippedCount: number;
    errors: string[];
    playlistUrl?: string | null;
  }>;
  disabled?: boolean;
}

export function TidalSync({ onSync, disabled = false }: TidalSyncProps) {
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [codeVerifier, setCodeVerifier] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const { getAuthUrl, authenticate, isGettingAuthUrl, isAuthenticating } =
    useTidalAuth('default');

  const handleSync = async () => {
    if (disabled || isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await onSync();
      if (result.success) {
        alert(
          `Successfully synced playlist to TIDAL!\n\nSynced: ${result.syncedCount} tracks\nSkipped: ${result.skippedCount} tracks${
            result.playlistUrl ? `\n\nPlaylist URL: ${result.playlistUrl}` : ''
          }${
            result.errors.length > 0
              ? `\n\nErrors:\n${result.errors.join('\n')}`
              : ''
          }`,
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
          await handleStartAuth();
        } else {
          alert(
            `Failed to sync playlist to TIDAL: ${result.errors.join(', ')}`,
          );
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
        try {
          await handleStartAuth();
        } catch (authError: any) {
          console.error('Failed to start TIDAL auth:', authError);
          alert(
            `Failed to start authentication: ${authError?.message || 'Unknown error'}`,
          );
        }
      } else {
        alert(`Failed to sync playlist to TIDAL: ${errorMessage}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStartAuth = async () => {
    try {
      console.log('Getting TIDAL auth URL (PKCE flow)...');
      const { authUrl: url, codeVerifier } = await getAuthUrl();
      console.log('TIDAL auth URL received:', url);

      if (!url || !codeVerifier) {
        throw new Error('No authorization URL or code verifier received');
      }

      setAuthUrl(url);
      setCodeVerifier(codeVerifier);
      setIsAuthDialogOpen(true);
      console.log('TIDAL auth dialog opened (PKCE flow)');
    } catch (error: any) {
      console.error('Failed to get TIDAL authorization:', error);
      const errorMsg =
        error?.message ||
        error?.response?.errors?.[0]?.message ||
        'Unknown error';
      alert(
        `Failed to get authorization: ${errorMsg}. Please check your backend configuration.`,
      );
    }
  };

  const handleCompleteAuth = async () => {
    if (!authCode.trim()) {
      alert('Please enter the authorization code');
      return;
    }

    if (!codeVerifier) {
      alert(
        'Missing code verifier. Please start the authentication process again.',
      );
      return;
    }

    try {
      const result = await authenticate({
        code: authCode,
        codeVerifier,
      });
      if (result.success) {
        setIsAuthDialogOpen(false);
        setAuthCode('');
        setAuthUrl(null);
        setCodeVerifier(null);
        alert('Successfully authenticated with TIDAL! Retrying sync...');
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
        <Music className="h-4 w-4 mr-2" />
        {isSyncing ? 'Syncing...' : 'Sync to TIDAL'}
      </DropdownMenuItem>

      {/* TIDAL Authentication Dialog - PKCE Flow */}
      <Dialog
        open={isAuthDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAuthDialogOpen(false);
            setAuthUrl(null);
            setCodeVerifier(null);
            setAuthCode('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authenticate with TIDAL</DialogTitle>
            <DialogDescription>
              To sync playlists to TIDAL, you need to authenticate first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isGettingAuthUrl ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Getting authorization URL...
                </p>
              </div>
            ) : authUrl ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    1. Click the button below to open TIDAL authorization page
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('Opening TIDAL auth URL:', authUrl);
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
                    className="w-full"
                    variant="outline"
                  >
                    <Music className="h-4 w-4 mr-2" />
                    Open TIDAL Authorization
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
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    2. After authorizing, TIDAL will redirect you to a page.
                    Look at the URL in your browser's address bar and copy the{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      code
                    </code>{' '}
                    parameter from the URL.
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    The redirect URL will look like:{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">
                      https://tidal-music.github.io/tidal-api-reference/oauth2-redirect.html?code=...
                    </code>{' '}
                    or{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      http://localhost:3000?code=...
                    </code>
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Copy everything after{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      code=
                    </code>{' '}
                    (until the next{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      &
                    </code>{' '}
                    or end of URL) and paste it below.
                  </p>
                  <Input
                    placeholder="Enter authorization code (from ?code= parameter in the redirect URL)"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    disabled={isAuthenticating}
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAuthDialogOpen(false);
                      setAuthCode('');
                      setAuthUrl(null);
                      setCodeVerifier(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCompleteAuth}
                    disabled={
                      !authCode.trim() || isAuthenticating || !codeVerifier
                    }
                  >
                    {isAuthenticating
                      ? 'Authenticating...'
                      : 'Complete Authentication'}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Failed to get authorization. Please try again.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
