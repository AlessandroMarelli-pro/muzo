import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import {
  useAiServiceSettings,
  useApplyAiServiceApiKeys,
  useSetAiServiceReplicas,
  useTestAiServiceConnection,
  useUpdateAiServiceApiKeys,
  useUpdateAiServiceSettings,
} from '@/services/ai-service-hooks';
import { CheckCircle2, CircleDashed, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function AiServiceSettings() {
  const { settings, isLoading, refetch } = useAiServiceSettings();
  const { testConnection, isTesting } = useTestAiServiceConnection();
  const { updateSettings, isUpdating } = useUpdateAiServiceSettings();
  const { setReplicas, isScaling } = useSetAiServiceReplicas();
  const { updateApiKeys, isSavingApiKeys } = useUpdateAiServiceApiKeys();
  const { applyApiKeys, isApplyingApiKeys } = useApplyAiServiceApiKeys();
  // Mirrors the backend's own guard (UpdateAiServiceSettingsUseCase /
  // SetAiServiceReplicasUseCase both refuse while any scan is active) so the control is disabled
  // before the user hits it, not just after a rejected request. This context is user-scoped; the
  // backend check is unscoped across all users and is the real authority.
  const { activeSessions } = useScanSessionContext();
  const scanInProgress = activeSessions.size > 0;

  const [mode, setMode] = useState<'local' | 'remote'>('remote');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [replicas, setReplicasInput] = useState(1);

  // API-key fields start empty -- secrets are never returned. An empty field on save means
  // "leave the stored value unchanged"; the `has*` flags drive the placeholder.
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [hfToken, setHfToken] = useState('');
  const [lastfmApiKey, setLastfmApiKey] = useState('');
  const [lastfmSecret, setLastfmSecret] = useState('');
  const [discogsApiKeys, setDiscogsApiKeys] = useState('');

  // Seed local form state from the loaded settings once, then let the user's own edits win --
  // a background refetch (e.g. after a successful save) shouldn't stomp on an in-progress edit.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (settings && !seeded) {
      setMode(settings.mode);
      setRemoteUrl(settings.remoteUrl ?? '');
      setReplicasInput(settings.replicas);
      setSeeded(true);
    }
  }, [settings, seeded]);

  const healthy = settings?.health?.overall ?? false;

  const handleTestConnection = async () => {
    try {
      const result = await testConnection({ url: remoteUrl, authToken: authToken || undefined });
      if (result.success) {
        toast.success(result.message || 'Connection OK');
      } else {
        toast.error(result.message || 'Connection failed');
      }
    } catch (error: any) {
      toast.error(`Test failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleSave = async () => {
    try {
      const result = await updateSettings({
        mode,
        remoteUrl: mode === 'remote' ? remoteUrl : undefined,
        // Empty field = leave the stored token unchanged (the UI never reads it back). Type a
        // dash-only convention isn't needed here since the field starts empty either way.
        authToken: authToken || undefined,
      });
      if (result.success) {
        toast.success(result.message);
        setAuthToken('');
        refetch();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(`Failed to save: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleScale = async () => {
    try {
      const result = await setReplicas(replicas);
      if (result.success) {
        toast.success(result.message);
        refetch();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(`Failed to scale: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleSaveApiKeys = async () => {
    try {
      const result = await updateApiKeys({
        // Only send fields the user actually typed into -- an untouched field must not clear the
        // stored value.
        ...(geminiApiKey && { geminiApiKey }),
        ...(hfToken && { hfToken }),
        ...(lastfmApiKey && { lastfmApiKey }),
        ...(lastfmSecret && { lastfmSecret }),
        ...(discogsApiKeys && { discogsApiKeys }),
      });
      if (result.success) {
        toast.success(result.message);
        setGeminiApiKey('');
        setHfToken('');
        setLastfmApiKey('');
        setLastfmSecret('');
        setDiscogsApiKeys('');
        refetch();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(`Failed to save keys: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleApplyApiKeys = async () => {
    try {
      const result = await applyApiKeys();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      refetch();
    } catch (error: any) {
      toast.error(`Failed to apply keys: ${error?.message || 'Unknown error'}`);
    }
  };

  const hasLocalInstance = (settings?.health?.instances?.length ?? 0) > 0;

  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">AI Service</h2>
            <p className="text-sm text-muted-foreground">
              Powers genre/BPM/key/mood analysis. Switches take effect immediately, no restart
              needed.
            </p>
          </div>
          {!isLoading && (
            <Badge variant={healthy ? 'success' : 'outline'} className="gap-1">
              {healthy ? (
                <CheckCircle2 className="h-3 w-3" aria-hidden />
              ) : (
                <CircleDashed className="h-3 w-3" aria-hidden />
              )}
              {healthy ? 'Healthy' : 'Unavailable'}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {scanInProgress && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            A scan is in progress -- switching the ai-service endpoint or changing replicas is
            disabled until it finishes, so running analysis jobs aren't cut off mid-batch.
          </p>
        )}

        <div className="space-y-2">
          <Label>Mode</Label>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => value && setMode(value as 'local' | 'remote')}
            variant="outline"
            size="sm"
            aria-label="AI service mode"
            disabled={scanInProgress}
          >
            <ToggleGroupItem value="local">Local</ToggleGroupItem>
            <ToggleGroupItem value="remote">Remote</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {mode === 'remote' ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ai-service-url">Endpoint URL</Label>
              <Input
                id="ai-service-url"
                placeholder="https://your-endpoint.hf.space"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-service-token">
                Token {settings?.hasAuthToken && !authToken ? '(leave blank to keep current)' : ''}
              </Label>
              <Input
                id="ai-service-token"
                type="password"
                placeholder={settings?.hasAuthToken ? '••••••••' : 'HF_TOKEN'}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isTesting || !remoteUrl}
                onClick={handleTestConnection}
              >
                {isTesting && <Loader2 className="h-3 w-3 animate-spin" />}
                Test connection
              </Button>
              <Button
                size="sm"
                disabled={isUpdating || !remoteUrl || scanInProgress}
                onClick={handleSave}
              >
                {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ai-service-replicas">Replicas</Label>
              <p className="text-xs text-muted-foreground">
                Each replica loads its own copy of the analysis models (a few GB of RAM). Applying
                a change scales live via Docker; the server rejects a count your host can't hold.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  id="ai-service-replicas"
                  type="number"
                  min={1}
                  className="w-24"
                  value={replicas}
                  disabled={scanInProgress}
                  onChange={(e) => setReplicasInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
                <Button size="sm" disabled={isScaling || scanInProgress} onClick={handleScale}>
                  {isScaling && <Loader2 className="h-3 w-3 animate-spin" />}
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isUpdating || scanInProgress}
                  onClick={handleSave}
                >
                  {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
                  Switch to Local
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Note: changing replica count does not change how many concurrent scan requests the
                backend sends -- that still requires a backend restart to adjust.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3 border-t pt-4">
          <div>
            <h3 className="text-sm font-medium">API keys</h3>
            <p className="text-xs text-muted-foreground">
              {mode === 'local'
                ? "Save stores your keys. Apply recreates the local analysis container to load them now (~30-60s to reload models); otherwise they apply on the next restart or replica change."
                : 'Stored for when you run local mode. A remote endpoint uses its own environment, not these.'}
            </p>
          </div>

          {(
            [
              {
                id: 'gemini',
                label: 'Gemini API key',
                stored: settings?.hasGeminiApiKey,
                value: geminiApiKey,
                set: setGeminiApiKey,
                hint: 'Google AI Studio key -- LLM filename cleaning.',
              },
              {
                id: 'hf',
                label: 'Hugging Face token',
                stored: settings?.hasHfToken,
                value: hfToken,
                set: setHfToken,
                hint: 'Only needed for private model repositories.',
              },
              {
                id: 'lastfm-key',
                label: 'Last.fm API key',
                stored: settings?.hasLastfmApiKey,
                value: lastfmApiKey,
                set: setLastfmApiKey,
                hint: 'Album art lookup.',
              },
              {
                id: 'lastfm-secret',
                label: 'Last.fm shared secret',
                stored: settings?.hasLastfmSecret,
                value: lastfmSecret,
                set: setLastfmSecret,
                hint: '',
              },
              {
                id: 'discogs',
                label: 'Discogs API keys',
                stored: settings?.hasDiscogsApiKeys,
                value: discogsApiKeys,
                set: setDiscogsApiKeys,
                hint: 'Comma-separated to rotate across a pool.',
              },
            ] as const
          ).map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={`ai-key-${field.id}`}>
                {field.label}{' '}
                {field.stored && !field.value ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    (leave blank to keep current)
                  </span>
                ) : null}
              </Label>
              <Input
                id={`ai-key-${field.id}`}
                type="password"
                autoComplete="off"
                placeholder={field.stored ? '••••••••' : ''}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
              />
              {field.hint ? (
                <p className="text-xs text-muted-foreground">{field.hint}</p>
              ) : null}
            </div>
          ))}

          <div className="flex gap-2">
            <Button size="sm" disabled={isSavingApiKeys} onClick={handleSaveApiKeys}>
              {isSavingApiKeys && <Loader2 className="h-3 w-3 animate-spin" />}
              Save API keys
            </Button>
            {settings?.mode === 'local' && (
              <Button
                size="sm"
                variant="outline"
                disabled={isApplyingApiKeys || scanInProgress || !hasLocalInstance}
                onClick={handleApplyApiKeys}
              >
                {isApplyingApiKeys && <Loader2 className="h-3 w-3 animate-spin" />}
                Apply to running container
              </Button>
            )}
          </div>
          {mode === 'local' && settings?.mode !== 'local' && (
            <p className="text-xs text-muted-foreground">
              Switch to Local mode above and save it first -- then you can apply keys to the
              running container.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
