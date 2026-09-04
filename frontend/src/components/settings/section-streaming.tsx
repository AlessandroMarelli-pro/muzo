import {
  CopyField,
  SaveButton,
  SecretField,
  SettingsBlock,
  SettingsCard,
} from '@/components/settings/settings-primitives';
import { useSectionDirty } from '@/components/settings/use-settings-dirty';
import { ProviderAuthDialog } from '@/components/third-party/provider-auth-dialog';
import { Button } from '@/components/ui/button';
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
import { API_BASE_URL } from '@/lib/api-config';
import { cn } from '@/lib/utils';
import {
  useIntegrationSettings,
  useUpdateIntegrationSettings,
  type UpdateIntegrationSettingsInput,
} from '@/services/integration-settings-hooks';
import {
  useConnectedProviders,
  useDisconnectProvider,
  useSpotifyAuth,
  useTidalAuth,
  useYouTubeAuth,
} from '@/services/playlist-hooks';
import { Check, CircleDashed, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const USER_ID = 'default';

/**
 * "Streaming" — one block per provider. Each block owns BOTH halves of that
 * provider: the OAuth app credentials Muzo's backend needs, and the account
 * connection those credentials enable. To the user, "Spotify" is one thing.
 */

type CredKey = keyof UpdateIntegrationSettingsInput;

interface Provider {
  id: 'spotify' | 'tidal' | 'youtube';
  name: string;
  console: string;
  clientIdKey: CredKey;
  clientSecretKey: CredKey;
  storedClientId: (s: IntegrationFlags) => boolean | undefined;
  storedClientSecret: (s: IntegrationFlags) => boolean | undefined;
}

interface IntegrationFlags {
  hasSpotifyClientId?: boolean;
  hasSpotifyClientSecret?: boolean;
  hasTidalClientId?: boolean;
  hasTidalClientSecret?: boolean;
  hasYoutubeClientId?: boolean;
  hasYoutubeClientSecret?: boolean;
}

const PROVIDERS: Provider[] = [
  {
    id: 'spotify',
    name: 'Spotify',
    console: 'https://developer.spotify.com/dashboard',
    clientIdKey: 'spotifyClientId',
    clientSecretKey: 'spotifyClientSecret',
    storedClientId: (s) => s.hasSpotifyClientId,
    storedClientSecret: (s) => s.hasSpotifyClientSecret,
  },
  {
    id: 'tidal',
    name: 'TIDAL',
    console: 'https://developer.tidal.com/dashboard',
    clientIdKey: 'tidalClientId',
    clientSecretKey: 'tidalClientSecret',
    storedClientId: (s) => s.hasTidalClientId,
    storedClientSecret: (s) => s.hasTidalClientSecret,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    console: 'https://console.cloud.google.com/apis/credentials',
    clientIdKey: 'youtubeClientId',
    clientSecretKey: 'youtubeClientSecret',
    storedClientId: (s) => s.hasYoutubeClientId,
    storedClientSecret: (s) => s.hasYoutubeClientSecret,
  },
];

export function SectionStreaming() {
  const { settings, isLoading, refetch } = useIntegrationSettings();
  const { updateSettings, isUpdating } = useUpdateIntegrationSettings();
  const {
    providers: connected,
    isLoading: isLoadingConnections,
    refetch: refetchConnections,
  } = useConnectedProviders(USER_ID);
  const { disconnect, isDisconnecting } = useDisconnectProvider(USER_ID);

  const [values, setValues] = useState<Record<string, string>>({});
  const set = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));

  const dirty = useMemo(() => Object.values(values).some(Boolean), [values]);
  useSectionDirty('streaming', dirty);

  const [disconnecting, setDisconnecting] = useState<Provider | null>(null);

  const handleSave = async () => {
    const input: UpdateIntegrationSettingsInput = {};
    for (const [k, v] of Object.entries(values)) if (v) (input as Record<string, string>)[k] = v;
    if (Object.keys(input).length === 0) {
      toast.info('Nothing to save — type a value into a field first.');
      return;
    }
    try {
      const result = await updateSettings(input);
      if (result.success) {
        toast.success(result.message);
        setValues({});
        refetch();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(`Failed to save: ${error?.message || 'Unknown error'}`);
    }
  };

  const confirmDisconnect = async () => {
    if (!disconnecting) return;
    const provider = disconnecting;
    setDisconnecting(null);
    try {
      const result = await disconnect(provider.id);
      if (result.success) {
        toast.success(`Disconnected ${provider.name}`);
        refetchConnections();
      } else {
        toast.error(result.message || `Failed to disconnect ${provider.name}`);
      }
    } catch (error: any) {
      toast.error(`Failed to disconnect ${provider.name}: ${error?.message || 'Unknown error'}`);
    }
  };

  const flags = (settings ?? {}) as IntegrationFlags;

  return (
    <div className="space-y-12">
      <SettingsBlock
        title="Streaming providers"
        description="Connect a streaming account to push Muzo playlists to it. Each provider needs its own developer app — paste those credentials here, then connect the account."
        action={
          <SaveButton
            dirty={dirty}
            saving={isUpdating}
            disabled={isLoading}
            onClick={handleSave}
            idleLabel="Credentials saved"
          >
            Save credentials
          </SaveButton>
        }
      >
        <SettingsCard className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Every provider console asks for a redirect / callback URL. Register this one with each:
          </p>
          <CopyField label="Redirect URL" value={API_BASE_URL} />
        </SettingsCard>

        <div className="space-y-4">
          {PROVIDERS.map((p) => (
            <ProviderBlock
              key={p.id}
              provider={p}
              connected={connected.includes(p.id)}
              isLoadingConnection={isLoadingConnections}
              storedClientId={p.storedClientId(flags)}
              storedClientSecret={p.storedClientSecret(flags)}
              clientIdValue={values[p.clientIdKey] ?? ''}
              clientSecretValue={values[p.clientSecretKey] ?? ''}
              onClientIdChange={(v) => set(p.clientIdKey, v)}
              onClientSecretChange={(v) => set(p.clientSecretKey, v)}
              onConnected={refetchConnections}
              onRequestDisconnect={() => setDisconnecting(p)}
              disconnectPending={isDisconnecting}
            />
          ))}
        </div>
      </SettingsBlock>

      <AlertDialog open={!!disconnecting} onOpenChange={(o) => !o && setDisconnecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {disconnecting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Muzo will stop syncing playlists to your {disconnecting?.name} account. Your{' '}
              {disconnecting?.name} developer credentials stay saved — you can reconnect any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep connected</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisconnect}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProviderBlock({
  provider,
  connected,
  isLoadingConnection,
  storedClientId,
  storedClientSecret,
  clientIdValue,
  clientSecretValue,
  onClientIdChange,
  onClientSecretChange,
  onConnected,
  onRequestDisconnect,
  disconnectPending,
}: {
  provider: Provider;
  connected: boolean;
  isLoadingConnection: boolean;
  storedClientId: boolean | undefined;
  storedClientSecret: boolean | undefined;
  clientIdValue: string;
  clientSecretValue: string;
  onClientIdChange: (v: string) => void;
  onClientSecretChange: (v: string) => void;
  onConnected: () => void;
  onRequestDisconnect: () => void;
  disconnectPending: boolean;
}) {
  // Credentials can also come from the backend's environment, so an unset stored
  // flag doesn't mean "can't connect" — the connect call surfaces the real error.
  const noStoredCredentials = !storedClientId && !storedClientSecret;

  return (
    <SettingsCard className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h3 className="font-semibold">{provider.name}</h3>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              connected ? 'text-success' : 'text-muted-foreground',
            )}
          >
            {connected ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <CircleDashed className="size-3.5" aria-hidden />
            )}
            {connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <a
          href={provider.console}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-4 hover:no-underline"
        >
          Open developer console ↗
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SecretField
          id={`streaming-${provider.id}-id`}
          label="Client ID"
          stored={storedClientId}
          value={clientIdValue}
          onChange={onClientIdChange}
          plainText
        />
        <SecretField
          id={`streaming-${provider.id}-secret`}
          label="Client secret"
          stored={storedClientSecret}
          value={clientSecretValue}
          onChange={onClientSecretChange}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ConnectControl
          provider={provider}
          connected={connected}
          disabled={isLoadingConnection}
          disconnectPending={disconnectPending}
          onConnected={onConnected}
          onRequestDisconnect={onRequestDisconnect}
        />
        {!connected && noStoredCredentials ? (
          <p className="text-xs text-muted-foreground">
            Uses a saved Client ID / secret, or the backend&apos;s environment if none is set.
          </p>
        ) : null}
      </div>
    </SettingsCard>
  );
}

/** Connect / disconnect for one provider. YouTube uses an auth-code paste; Spotify & TIDAL use PKCE. */
function ConnectControl({
  provider,
  connected,
  disabled,
  disconnectPending,
  onConnected,
  onRequestDisconnect,
}: {
  provider: Provider;
  connected: boolean;
  disabled: boolean;
  disconnectPending: boolean;
  onConnected: () => void;
  onRequestDisconnect: () => void;
}) {
  const youtube = useYouTubeAuth(USER_ID);
  const tidal = useTidalAuth(USER_ID);
  const spotify = useSpotifyAuth(USER_ID);

  const [open, setOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [verifier, setVerifier] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const isPkce = provider.id !== 'youtube';
  const gettingUrl =
    provider.id === 'youtube'
      ? youtube.isGettingAuthUrl
      : provider.id === 'tidal'
        ? tidal.isGettingAuthUrl
        : spotify.isGettingAuthUrl;
  const authenticating =
    provider.id === 'youtube'
      ? youtube.isAuthenticating
      : provider.id === 'tidal'
        ? tidal.isAuthenticating
        : spotify.isAuthenticating;

  const reset = () => {
    setOpen(false);
    setCode('');
    setAuthUrl(null);
    setVerifier(null);
  };

  const startConnect = async () => {
    try {
      if (provider.id === 'youtube') {
        const url = await youtube.getAuthUrl();
        if (!url) throw new Error('No authorization URL received');
        setAuthUrl(url);
      } else {
        const getUrl = provider.id === 'tidal' ? tidal.getAuthUrl : spotify.getAuthUrl;
        const { authUrl: url, codeVerifier } = await getUrl();
        if (!url || !codeVerifier) throw new Error('No authorization URL received');
        setAuthUrl(url);
        setVerifier(codeVerifier);
      }
      setOpen(true);
    } catch (error: any) {
      toast.error(`Failed to start ${provider.name} connect: ${error?.message || 'Unknown error'}`);
    }
  };

  const complete = async () => {
    try {
      let result: { success: boolean; message?: string };
      if (provider.id === 'youtube') {
        result = await youtube.authenticate(code);
      } else if (provider.id === 'tidal') {
        if (!verifier) throw new Error('Missing code verifier — start again');
        result = await tidal.authenticate({ code, codeVerifier: verifier });
      } else {
        if (!verifier) throw new Error('Missing code verifier — start again');
        result = await spotify.authenticate({ code, codeVerifier: verifier });
      }
      if (result.success) {
        reset();
        toast.success(`Connected to ${provider.name}`);
        onConnected();
      } else {
        toast.error(`Authentication failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      toast.error(`Failed to authenticate: ${error?.message || 'Unknown error'}`);
    }
  };

  if (connected) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={disconnectPending}
        onClick={onRequestDisconnect}
      >
        Disconnect
      </Button>
    );
  }

  return (
    <>
      <Button size="sm" disabled={disabled || gettingUrl} onClick={startConnect}>
        {gettingUrl ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
        Connect {provider.name}
      </Button>
      <ProviderAuthDialog
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : reset())}
        providerLabel={provider.name}
        authUrl={authUrl}
        isLoadingUrl={gettingUrl}
        code={code}
        onCodeChange={setCode}
        onComplete={complete}
        isCompleting={authenticating}
        canComplete={!isPkce || !!verifier}
      />
    </>
  );
}
