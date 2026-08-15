import { Playlist } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useTidalAuth, useYouTubeAuth } from '@/services/playlist-hooks';
import { ChevronDown, Music, Music2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { SpotifySync } from './third-party-apps/spotify-sync';
import { TidalSync, type TidalSyncHandle } from './third-party-apps/tidal-sync';
import { YouTubeSync, type YouTubeSyncHandle } from './third-party-apps/youtube-sync';

interface PlaylistDetailThirdPartiesProps {
  playlist: Playlist | undefined;
  isLoading: boolean;
  onSyncToYouTube: () => Promise<{
    success: boolean;
    syncedCount: number;
    skippedCount: number;
    errors: string[];
    playlistUrl?: string | null;
  }>;
  onSyncToTidal: () => Promise<{
    success: boolean;
    syncedCount: number;
    skippedCount: number;
    errors: string[];
    playlistUrl?: string | null;
  }>;
  onSyncToSpotify: () => Promise<{
    success: boolean;
    syncedCount: number;
    skippedCount: number;
    errors: string[];
    playlistUrl?: string | null;
  }>;
}

export function PlaylistDetailThirdParties({
  playlist,
  isLoading,
  onSyncToYouTube,
  onSyncToTidal,
  onSyncToSpotify,
}: PlaylistDetailThirdPartiesProps) {
  const isDisabled = isLoading || !playlist;

  // Owned here (not inside DropdownMenuContent) because Radix unmounts the
  // menu's children once it closes, which would destroy this dialog's state
  // before the async getAuthUrl() call triggered from a menu item resolves.
  const [isYouTubeAuthDialogOpen, setIsYouTubeAuthDialogOpen] = useState(false);
  const [youtubeAuthUrl, setYoutubeAuthUrl] = useState<string | null>(null);
  const [youtubeAuthCode, setYoutubeAuthCode] = useState('');
  const youtubeSyncRef = useRef<YouTubeSyncHandle>(null);

  const {
    getAuthUrl: getYouTubeAuthUrl,
    authenticate: authenticateYouTube,
    isGettingAuthUrl: isGettingYouTubeAuthUrl,
    isAuthenticating: isAuthenticatingYouTube,
  } = useYouTubeAuth('default');

  const handleNeedYouTubeAuth = async () => {
    try {
      const url = await getYouTubeAuthUrl();
      if (!url) {
        throw new Error('No authorization URL received');
      }
      setYoutubeAuthUrl(url);
      setIsYouTubeAuthDialogOpen(true);
    } catch (error: any) {
      console.error('Failed to get YouTube auth URL:', error);
      const errorMsg = error?.message || error?.response?.errors?.[0]?.message || 'Unknown error';
      alert(
        `Failed to get authentication URL: ${errorMsg}. Please check your backend configuration.`,
      );
    }
  };

  const closeYouTubeAuthDialog = () => {
    setIsYouTubeAuthDialogOpen(false);
    setYoutubeAuthCode('');
    setYoutubeAuthUrl(null);
  };

  const handleCompleteYouTubeAuth = async () => {
    if (!youtubeAuthCode.trim()) {
      alert('Please enter the authorization code');
      return;
    }

    try {
      const result = await authenticateYouTube(youtubeAuthCode);
      if (result.success) {
        closeYouTubeAuthDialog();
        alert('Successfully authenticated with YouTube! Retrying sync...');
        setTimeout(() => {
          youtubeSyncRef.current?.retrySync();
        }, 500);
      } else {
        alert(`Authentication failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Failed to authenticate:', error);
      alert(`Failed to authenticate: ${error.message || 'Unknown error'}`);
    }
  };

  const [isTidalAuthDialogOpen, setIsTidalAuthDialogOpen] = useState(false);
  const [tidalAuthUrl, setTidalAuthUrl] = useState<string | null>(null);
  const [tidalCodeVerifier, setTidalCodeVerifier] = useState<string | null>(null);
  const [tidalAuthCode, setTidalAuthCode] = useState('');
  const tidalSyncRef = useRef<TidalSyncHandle>(null);

  const {
    getAuthUrl: getTidalAuthUrl,
    authenticate: authenticateTidal,
    isGettingAuthUrl: isGettingTidalAuthUrl,
    isAuthenticating: isAuthenticatingTidal,
  } = useTidalAuth('default');

  const handleNeedTidalAuth = async () => {
    try {
      const { authUrl: url, codeVerifier: verifier } = await getTidalAuthUrl();
      if (!url || !verifier) {
        throw new Error('No authorization URL or code verifier received');
      }
      setTidalAuthUrl(url);
      setTidalCodeVerifier(verifier);
      setIsTidalAuthDialogOpen(true);
    } catch (error: any) {
      console.error('Failed to get TIDAL authorization:', error);
      const errorMsg = error?.message || error?.response?.errors?.[0]?.message || 'Unknown error';
      alert(`Failed to get authorization: ${errorMsg}. Please check your backend configuration.`);
    }
  };

  const closeTidalAuthDialog = () => {
    setIsTidalAuthDialogOpen(false);
    setTidalAuthCode('');
    setTidalAuthUrl(null);
    setTidalCodeVerifier(null);
  };

  const handleCompleteTidalAuth = async () => {
    if (!tidalAuthCode.trim()) {
      alert('Please enter the authorization code');
      return;
    }
    if (!tidalCodeVerifier) {
      alert('Missing code verifier. Please start the authentication process again.');
      return;
    }

    try {
      const result = await authenticateTidal({
        code: tidalAuthCode,
        codeVerifier: tidalCodeVerifier,
      });
      if (result.success) {
        closeTidalAuthDialog();
        alert('Successfully authenticated with TIDAL! Retrying sync...');
        setTimeout(() => {
          tidalSyncRef.current?.retrySync();
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" disabled={isDisabled}>
            <Music2 className="h-4 w-4 mr-2" />
            Sync
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <YouTubeSync
            ref={youtubeSyncRef}
            onSync={onSyncToYouTube}
            onNeedAuth={handleNeedYouTubeAuth}
            disabled={isDisabled}
          />
          <TidalSync
            ref={tidalSyncRef}
            onSync={onSyncToTidal}
            onNeedAuth={handleNeedTidalAuth}
            disabled={isDisabled}
          />
          <SpotifySync onSync={onSyncToSpotify} disabled={isDisabled} />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* YouTube Authentication Dialog */}
      <Dialog open={isYouTubeAuthDialogOpen} onOpenChange={setIsYouTubeAuthDialogOpen}>
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
              {youtubeAuthUrl ? (
                <>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      const newWindow = window.open(youtubeAuthUrl, '_blank', 'noopener,noreferrer');
                      if (!newWindow || newWindow.closed) {
                        alert(
                          'Popup blocked. Please click the link below to open the authorization page.',
                        );
                      }
                    }}
                    disabled={isGettingYouTubeAuthUrl}
                    className="w-full"
                    variant="outline"
                  >
                    {isGettingYouTubeAuthUrl ? 'Loading…' : 'Open YouTube Authorization'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Or{' '}
                    <a
                      href={youtubeAuthUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:no-underline"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open(youtubeAuthUrl, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      click here to open in a new tab
                    </a>
                  </p>
                </>
              ) : (
                <Button disabled className="w-full" variant="outline">
                  {isGettingYouTubeAuthUrl ? 'Loading authorization URL…' : 'No URL available'}
                </Button>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                2. After authorizing, copy the authorization code from the URL and paste it below
              </p>
              <Input
                placeholder="Enter authorization code"
                value={youtubeAuthCode}
                onChange={(e) => setYoutubeAuthCode(e.target.value)}
                disabled={isAuthenticatingYouTube}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeYouTubeAuthDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleCompleteYouTubeAuth}
              disabled={!youtubeAuthCode.trim() || isAuthenticatingYouTube}
            >
              {isAuthenticatingYouTube ? 'Authenticating…' : 'Complete Authentication'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TIDAL Authentication Dialog - PKCE Flow */}
      <Dialog
        open={isTidalAuthDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeTidalAuthDialog();
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
            {isGettingTidalAuthUrl ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Getting authorization URL...</p>
              </div>
            ) : tidalAuthUrl ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    1. Click the button below to open TIDAL authorization page
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      const newWindow = window.open(tidalAuthUrl, '_blank', 'noopener,noreferrer');
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
                      href={tidalAuthUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:no-underline"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open(tidalAuthUrl, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      click here to open in a new tab
                    </a>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    2. After authorizing, TIDAL will redirect you to a page. Look at the URL in
                    your browser's address bar and copy the{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">code</code> parameter
                    from the URL.
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
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">code=</code> (until the
                    next <code className="text-xs bg-muted px-1 py-0.5 rounded">&</code> or end of
                    URL) and paste it below.
                  </p>
                  <Input
                    placeholder="Enter authorization code (from ?code= parameter in the redirect URL)"
                    value={tidalAuthCode}
                    onChange={(e) => setTidalAuthCode(e.target.value)}
                    disabled={isAuthenticatingTidal}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeTidalAuthDialog}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCompleteTidalAuth}
                    disabled={!tidalAuthCode.trim() || isAuthenticatingTidal || !tidalCodeVerifier}
                  >
                    {isAuthenticatingTidal ? 'Authenticating…' : 'Complete Authentication'}
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
