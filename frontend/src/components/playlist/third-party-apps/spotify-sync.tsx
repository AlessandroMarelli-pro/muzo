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
import { useSpotifyAuth } from '@/services/playlist-hooks';
import { Music2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface SpotifySyncProps {
  onSync: () => Promise<{
    success: boolean;
    syncedCount: number;
    skippedCount: number;
    errors: string[];
    playlistUrl?: string | null;
  }>;
  disabled?: boolean;
}

export function SpotifySync({ onSync, disabled = false }: SpotifySyncProps) {
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [codeVerifier, setCodeVerifier] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const { getAuthUrl, authenticate, isGettingAuthUrl, isAuthenticating } =
    useSpotifyAuth('default');

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
          `Synced ${result.syncedCount} tracks to Spotify${
            result.skippedCount > 0 ? ` · ${result.skippedCount} skipped` : ''
          }`,
        );
      } else {
        const errorMessages = result.errors.join(' ').toLowerCase();
        const isAuthError =
          errorMessages.includes('not authenticated') ||
          errorMessages.includes('unauthorized') ||
          errorMessages.includes('authorize') ||
          errorMessages.includes('authentication') ||
          errorMessages.includes('spotify not authenticated') ||
          errorMessages.includes('please authorize');

        if (isAuthError) {
          await handleStartAuth();
        } else {
          toast.error(`Couldn't sync to Spotify: ${result.errors.join(', ')}`);
        }
      }
    } catch (error: any) {
      console.error('Failed to sync playlist to Spotify:', error);

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
        errorMessage.includes('Spotify not authenticated');

      if (isAuthError) {
        try {
          await handleStartAuth();
        } catch (authError: any) {
          console.error('Failed to start Spotify auth:', authError);
          toast.error(`Couldn't start Spotify authentication: ${authError?.message || 'Unknown error'}`);
        }
      } else {
        toast.error(`Couldn't sync to Spotify: ${errorMessage}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStartAuth = async () => {
    try {
      console.log('Getting Spotify auth URL (PKCE flow)...');
      const { authUrl: url, codeVerifier: verifier } = await getAuthUrl();
      console.log('Spotify auth URL received:', url);

      if (!url || !verifier) {
        throw new Error('No authorization URL or code verifier received');
      }

      setAuthUrl(url);
      setCodeVerifier(verifier);
      setIsAuthDialogOpen(true);
      console.log('Spotify auth dialog opened (PKCE flow)');
    } catch (error: any) {
      console.error('Failed to get Spotify authorization:', error);
      const errorMsg = error?.message || error?.response?.errors?.[0]?.message || 'Unknown error';
      toast.error(`Couldn't get a Spotify authorization link: ${errorMsg}`);
    }
  };

  const handleCompleteAuth = async () => {
    if (!authCode.trim()) {
      toast.error('Enter the authorization code first.');
      return;
    }

    if (!codeVerifier) {
      toast.error('Session expired — start the authentication again.');
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
        toast.success('Connected to Spotify. Retrying sync…');
        setTimeout(() => {
          handleSync();
        }, 500);
      } else {
        toast.error(`Spotify authentication failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Failed to authenticate:', error);
      toast.error(`Spotify authentication failed: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <>
      <DropdownMenuItem onClick={handleSync} disabled={disabled || isSyncing}>
        <Music2 className="h-4 w-4 mr-2" />
        {isSyncing ? 'Syncing…' : 'Sync to Spotify'}
      </DropdownMenuItem>

      {/* Spotify Authentication Dialog - PKCE Flow */}
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
            <DialogTitle>Authenticate with Spotify</DialogTitle>
            <DialogDescription>
              To sync playlists to Spotify, you need to authenticate first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isGettingAuthUrl ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Getting authorization URL…</p>
              </div>
            ) : authUrl ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    1. Click the button below to open Spotify authorization page
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('Opening Spotify auth URL:', authUrl);
                      const newWindow = window.open(authUrl, '_blank', 'noopener,noreferrer');
                      if (!newWindow || newWindow.closed) {
                        toast.error('Popup blocked — use the link below to open the page.');
                      }
                    }}
                    className="w-full"
                    variant="outline"
                  >
                    <Music2 className="h-4 w-4 mr-2" />
                    Open Spotify Authorization
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
                    2. After authorizing, Spotify will redirect you to a page. Look at the URL in
                    your browser's address bar and copy the{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">code</code> parameter
                    from the URL.
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    The redirect URL will look like:{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">
                      http://localhost:3000?code=...
                    </code>
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Copy everything after{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">code=</code> (until the
                    next <code className="text-xs bg-muted px-1 py-0.5 rounded">&</code> or end of
                    URL) and paste it below.
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
                    disabled={!authCode.trim() || isAuthenticating || !codeVerifier}
                  >
                    {isAuthenticating ? 'Authenticating…' : 'Complete Authentication'}
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
