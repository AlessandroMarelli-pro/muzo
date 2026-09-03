import { Playlist } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProviderAuthDialog } from '@/components/third-party/provider-auth-dialog';
import { useTidalAuth, useYouTubeAuth } from '@/services/playlist-hooks';
import { ChevronDown, Music2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
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
      toast.error(`Couldn't get a YouTube authorization link: ${errorMsg}`);
    }
  };

  const closeYouTubeAuthDialog = () => {
    setIsYouTubeAuthDialogOpen(false);
    setYoutubeAuthCode('');
    setYoutubeAuthUrl(null);
  };

  const handleCompleteYouTubeAuth = async () => {
    if (!youtubeAuthCode.trim()) {
      toast.error('Enter the authorization code first.');
      return;
    }

    try {
      const result = await authenticateYouTube(youtubeAuthCode);
      if (result.success) {
        closeYouTubeAuthDialog();
        toast.success('Connected to YouTube. Retrying sync…');
        setTimeout(() => {
          youtubeSyncRef.current?.retrySync();
        }, 500);
      } else {
        toast.error(`YouTube authentication failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Failed to authenticate:', error);
      toast.error(`YouTube authentication failed: ${error.message || 'Unknown error'}`);
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
      toast.error(`Couldn't get a TIDAL authorization link: ${errorMsg}`);
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
      toast.error('Enter the authorization code first.');
      return;
    }
    if (!tidalCodeVerifier) {
      toast.error('Session expired — start the authentication again.');
      return;
    }

    try {
      const result = await authenticateTidal({
        code: tidalAuthCode,
        codeVerifier: tidalCodeVerifier,
      });
      if (result.success) {
        closeTidalAuthDialog();
        toast.success('Connected to TIDAL. Retrying sync…');
        setTimeout(() => {
          tidalSyncRef.current?.retrySync();
        }, 500);
      } else {
        toast.error(`TIDAL authentication failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Failed to authenticate:', error);
      toast.error(`TIDAL authentication failed: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" disabled={isDisabled}>
            <Music2 className="h-4 w-4" aria-hidden />
            Sync
            <ChevronDown className="h-4 w-4" aria-hidden />
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

      <ProviderAuthDialog
        open={isYouTubeAuthDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeYouTubeAuthDialog();
          else setIsYouTubeAuthDialogOpen(true);
        }}
        providerLabel="YouTube"
        authUrl={youtubeAuthUrl}
        isLoadingUrl={isGettingYouTubeAuthUrl}
        code={youtubeAuthCode}
        onCodeChange={setYoutubeAuthCode}
        onComplete={handleCompleteYouTubeAuth}
        isCompleting={isAuthenticatingYouTube}
      />

      <ProviderAuthDialog
        open={isTidalAuthDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeTidalAuthDialog();
          else setIsTidalAuthDialogOpen(true);
        }}
        providerLabel="TIDAL"
        authUrl={tidalAuthUrl}
        isLoadingUrl={isGettingTidalAuthUrl}
        code={tidalAuthCode}
        onCodeChange={setTidalAuthCode}
        onComplete={handleCompleteTidalAuth}
        isCompleting={isAuthenticatingTidal}
        canComplete={!!tidalCodeVerifier}
      />
    </>
  );
}
