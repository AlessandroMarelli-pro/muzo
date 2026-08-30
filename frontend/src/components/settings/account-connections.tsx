import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProviderAuthDialog } from '@/components/third-party/provider-auth-dialog';
import {
  useConnectedProviders,
  useDisconnectProvider,
  useTidalAuth,
  useYouTubeAuth,
} from '@/services/playlist-hooks';
import { Music, Youtube } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const USER_ID = 'default';

export function AccountConnections() {
  const { providers, isLoading, refetch } = useConnectedProviders(USER_ID);
  const { disconnect, isDisconnecting } = useDisconnectProvider(USER_ID);

  // YouTube connect flow
  const [isYouTubeDialogOpen, setIsYouTubeDialogOpen] = useState(false);
  const [youtubeAuthUrl, setYoutubeAuthUrl] = useState<string | null>(null);
  const [youtubeCode, setYoutubeCode] = useState('');
  const {
    getAuthUrl: getYouTubeAuthUrl,
    authenticate: authenticateYouTube,
    isGettingAuthUrl: isGettingYouTubeAuthUrl,
    isAuthenticating: isAuthenticatingYouTube,
  } = useYouTubeAuth(USER_ID);

  const closeYouTubeDialog = () => {
    setIsYouTubeDialogOpen(false);
    setYoutubeCode('');
    setYoutubeAuthUrl(null);
  };

  const handleConnectYouTube = async () => {
    try {
      const url = await getYouTubeAuthUrl();
      if (!url) throw new Error('No authorization URL received');
      setYoutubeAuthUrl(url);
      setIsYouTubeDialogOpen(true);
    } catch (error: any) {
      toast.error(`Failed to get authorization URL: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleCompleteYouTube = async () => {
    try {
      const result = await authenticateYouTube(youtubeCode);
      if (result.success) {
        closeYouTubeDialog();
        toast.success('Connected to YouTube');
        refetch();
      } else {
        toast.error(`Authentication failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      toast.error(`Failed to authenticate: ${error?.message || 'Unknown error'}`);
    }
  };

  // TIDAL connect flow (PKCE)
  const [isTidalDialogOpen, setIsTidalDialogOpen] = useState(false);
  const [tidalAuthUrl, setTidalAuthUrl] = useState<string | null>(null);
  const [tidalCodeVerifier, setTidalCodeVerifier] = useState<string | null>(null);
  const [tidalCode, setTidalCode] = useState('');
  const {
    getAuthUrl: getTidalAuthUrl,
    authenticate: authenticateTidal,
    isGettingAuthUrl: isGettingTidalAuthUrl,
    isAuthenticating: isAuthenticatingTidal,
  } = useTidalAuth(USER_ID);

  const closeTidalDialog = () => {
    setIsTidalDialogOpen(false);
    setTidalCode('');
    setTidalAuthUrl(null);
    setTidalCodeVerifier(null);
  };

  const handleConnectTidal = async () => {
    try {
      const { authUrl: url, codeVerifier: verifier } = await getTidalAuthUrl();
      if (!url || !verifier) throw new Error('No authorization URL or code verifier received');
      setTidalAuthUrl(url);
      setTidalCodeVerifier(verifier);
      setIsTidalDialogOpen(true);
    } catch (error: any) {
      toast.error(`Failed to get authorization: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleCompleteTidal = async () => {
    if (!tidalCodeVerifier) {
      toast.error('Missing code verifier. Please start again.');
      return;
    }
    try {
      const result = await authenticateTidal({ code: tidalCode, codeVerifier: tidalCodeVerifier });
      if (result.success) {
        closeTidalDialog();
        toast.success('Connected to TIDAL');
        refetch();
      } else {
        toast.error(`Authentication failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      toast.error(`Failed to authenticate: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleDisconnect = async (provider: string, label: string) => {
    if (!window.confirm(`Disconnect your ${label} account?`)) return;
    try {
      const result = await disconnect(provider);
      if (result.success) {
        toast.success(`Disconnected ${label}`);
        refetch();
      } else {
        toast.error(result.message || `Failed to disconnect ${label}`);
      }
    } catch (error: any) {
      toast.error(`Failed to disconnect ${label}: ${error?.message || 'Unknown error'}`);
    }
  };

  const rows = [
    {
      provider: 'youtube',
      label: 'YouTube',
      icon: Youtube,
      onConnect: handleConnectYouTube,
    },
    {
      provider: 'tidal',
      label: 'TIDAL',
      icon: Music,
      onConnect: handleConnectTidal,
    },
  ];

  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Connections</h2>
        <p className="text-sm text-muted-foreground">
          Connect your streaming accounts to sync playlists.
        </p>
      </div>
      <ul className="divide-y">
        {rows.map(({ provider, label, icon: Icon, onConnect }) => {
          const connected = providers.includes(provider);
          return (
            <li key={provider} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label}</span>
                <Badge variant={connected ? 'default' : 'outline'}>
                  {connected ? 'Connected' : 'Not connected'}
                </Badge>
              </div>
              {connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isDisconnecting}
                  onClick={() => handleDisconnect(provider, label)}
                >
                  Disconnect
                </Button>
              ) : (
                <Button size="sm" disabled={isLoading} onClick={onConnect}>
                  Connect
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <ProviderAuthDialog
        open={isYouTubeDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeYouTubeDialog();
          else setIsYouTubeDialogOpen(true);
        }}
        providerLabel="YouTube"
        authUrl={youtubeAuthUrl}
        isLoadingUrl={isGettingYouTubeAuthUrl}
        code={youtubeCode}
        onCodeChange={setYoutubeCode}
        onComplete={handleCompleteYouTube}
        isCompleting={isAuthenticatingYouTube}
      />

      <ProviderAuthDialog
        open={isTidalDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeTidalDialog();
          else setIsTidalDialogOpen(true);
        }}
        providerLabel="TIDAL"
        authUrl={tidalAuthUrl}
        isLoadingUrl={isGettingTidalAuthUrl}
        code={tidalCode}
        onCodeChange={setTidalCode}
        onComplete={handleCompleteTidal}
        isCompleting={isAuthenticatingTidal}
        canComplete={!!tidalCodeVerifier}
      />
    </div>
  );
}
