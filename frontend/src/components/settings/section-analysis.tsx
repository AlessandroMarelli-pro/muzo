import {
  SaveButton,
  SecretField,
  SettingsBlock,
  SettingsCard,
} from '@/components/settings/settings-primitives';
import { useSectionDirty } from '@/components/settings/use-settings-dirty';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import {
  useAiServiceSettings,
  useApplyAiServiceApiKeys,
  useSetAiServiceReplicas,
  useTestAiServiceConnection,
  useUpdateAiServiceApiKeys,
  useUpdateAiServiceSettings,
} from '@/services/ai-service-hooks';
import { cn } from '@/lib/utils';
import { Check, CircleDashed, Cpu, Loader2, Minus, Plus, RefreshCw, ServerCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * "Analysis" — the engine that classifies every track, plus the third-party
 * keys that enrich that work. This is the hero of Settings for a local-first
 * product: analysis works with zero keys; each key unlocks one more capability.
 */

interface KeyInput {
  id: string;
  label: string;
  hint?: string;
  stored: boolean | undefined;
  value: string;
  set: (v: string) => void;
  plainText?: boolean;
}

interface Capability {
  id: string;
  /** The user-facing outcome, not the vendor. */
  capability: string;
  detail: string;
  /** One capability can need more than one key (Last.fm: API key + shared secret). */
  fields: KeyInput[];
}

export function SectionAnalysis() {
  const { settings, isLoading, refetch } = useAiServiceSettings();
  const { testConnection, isTesting } = useTestAiServiceConnection();
  const { updateSettings, isUpdating } = useUpdateAiServiceSettings();
  const { setReplicas, isScaling } = useSetAiServiceReplicas();
  const { updateApiKeys, isSavingApiKeys } = useUpdateAiServiceApiKeys();
  const { applyApiKeys, isApplyingApiKeys } = useApplyAiServiceApiKeys();

  // Mirrors the backend guard: switching endpoint or replicas is refused while a
  // scan runs so in-flight analysis batches aren't cut off.
  const { activeSessions } = useScanSessionContext();
  const scanInProgress = activeSessions.size > 0;

  const [mode, setMode] = useState<'local' | 'remote'>('local');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [replicas, setReplicasInput] = useState(1);

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [hfToken, setHfToken] = useState('');
  const [lastfmApiKey, setLastfmApiKey] = useState('');
  const [lastfmSecret, setLastfmSecret] = useState('');
  const [discogsApiKeys, setDiscogsApiKeys] = useState('');

  // Seed local form state once from the loaded settings, then let user edits win
  // over a background refetch.
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
  const hasLocalInstance = (settings?.health?.instances?.length ?? 0) > 0;

  const engineDirty =
    !!settings &&
    (mode !== settings.mode ||
      (mode === 'remote' && remoteUrl !== (settings.remoteUrl ?? '')) ||
      !!authToken);
  const replicasDirty = !!settings && mode === 'local' && replicas !== settings.replicas;
  const keysDirty =
    !!geminiApiKey || !!hfToken || !!lastfmApiKey || !!lastfmSecret || !!discogsApiKeys;

  useSectionDirty('analysis', engineDirty || replicasDirty || keysDirty);

  const handleTestConnection = async () => {
    try {
      const result = await testConnection({ url: remoteUrl, authToken: authToken || undefined });
      if (result.success) toast.success(result.message || 'Connection OK');
      else toast.error(result.message || 'Connection failed');
    } catch (error: any) {
      toast.error(`Test failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleSaveEngine = async () => {
    try {
      const result = await updateSettings({
        mode,
        remoteUrl: mode === 'remote' ? remoteUrl : undefined,
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

  const handleSaveKeys = async () => {
    try {
      const result = await updateApiKeys({
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

  const handleApplyKeys = async () => {
    try {
      const result = await applyApiKeys();
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
      refetch();
    } catch (error: any) {
      toast.error(`Failed to apply keys: ${error?.message || 'Unknown error'}`);
    }
  };

  const capabilities: Capability[] = [
    {
      id: 'gemini',
      capability: 'Clean up messy filenames',
      detail: 'An LLM rewrites "03_-_track(FINAL).mp3" into real artist / title fields.',
      fields: [
        {
          id: 'gemini',
          label: 'Gemini API key',
          hint: 'From Google AI Studio.',
          stored: settings?.hasGeminiApiKey,
          value: geminiApiKey,
          set: setGeminiApiKey,
        },
      ],
    },
    {
      id: 'discogs',
      capability: 'Genre, label & release data',
      detail: 'Discogs fills in the release a track came from and its catalogue genre.',
      fields: [
        {
          id: 'discogs',
          label: 'Discogs API keys',
          hint: 'Comma-separate several to rotate across a pool and dodge rate limits.',
          stored: settings?.hasDiscogsApiKeys,
          value: discogsApiKeys,
          set: setDiscogsApiKeys,
        },
      ],
    },
    {
      id: 'lastfm',
      capability: 'Album artwork',
      detail: 'Last.fm supplies cover images for tracks that ship without embedded art.',
      fields: [
        {
          id: 'lastfm-key',
          label: 'Last.fm API key',
          stored: settings?.hasLastfmApiKey,
          value: lastfmApiKey,
          set: setLastfmApiKey,
        },
        {
          id: 'lastfm-secret',
          label: 'Shared secret',
          stored: settings?.hasLastfmSecret,
          value: lastfmSecret,
          set: setLastfmSecret,
        },
      ],
    },
    {
      id: 'hf',
      capability: 'Private model repositories',
      detail: 'Only needed if you point Muzo at a gated Hugging Face model.',
      fields: [
        {
          id: 'hf',
          label: 'Hugging Face token',
          stored: settings?.hasHfToken,
          value: hfToken,
          set: setHfToken,
        },
      ],
    },
  ];

  return (
    <div className="space-y-12">
      {scanInProgress ? (
        <div
          role="status"
          className="rounded-xl border border-warning-border bg-warning-surface px-4 py-3 text-sm text-warning-foreground"
        >
          A scan is running. Switching the analysis engine or changing replicas is paused until it
          finishes, so running jobs aren&apos;t cut off mid-batch. Enrichment keys can still be
          saved.
        </div>
      ) : null}

      {/* --- Engine --- */}
      <SettingsBlock
        title="Analysis engine"
        description="Runs genre, BPM, key and mood analysis on every track. Changes take effect immediately — no restart."
        action={
          !isLoading ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium',
                healthy ? 'text-success' : 'text-muted-foreground',
              )}
            >
              {healthy ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <CircleDashed className="size-3.5" aria-hidden />
              )}
              {healthy ? 'Running' : 'Not reachable'}
            </span>
          ) : null
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <EngineChoice
            active={mode === 'local'}
            disabled={scanInProgress}
            onClick={() => setMode('local')}
            icon={<Cpu className="size-4" aria-hidden />}
            title="Local"
            body="Muzo runs the analysis models in its own container on this machine. No account, no upload. The usual choice for a self-hosted setup."
          />
          <EngineChoice
            active={mode === 'remote'}
            disabled={scanInProgress}
            onClick={() => setMode('remote')}
            icon={<ServerCog className="size-4" aria-hidden />}
            title="Remote"
            body="Point at an analysis endpoint you host elsewhere (e.g. a GPU box or a Hugging Face Space). Muzo sends audio to that URL."
          />
        </div>

        {mode === 'remote' ? (
          <SettingsCard className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="analysis-endpoint">Endpoint URL</Label>
              <Input
                id="analysis-endpoint"
                placeholder="https://your-endpoint.hf.space"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
              />
            </div>
            <SecretField
              id="analysis-token"
              label="Access token"
              stored={settings?.hasAuthToken}
              value={authToken}
              onChange={setAuthToken}
              hint="Sent as a bearer token with each request. Leave blank to keep the saved one."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isTesting || !remoteUrl}
                onClick={handleTestConnection}
              >
                {isTesting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                Test connection
              </Button>
              <SaveButton
                dirty={engineDirty}
                saving={isUpdating}
                disabled={!remoteUrl || scanInProgress}
                onClick={handleSaveEngine}
                idleLabel="Endpoint saved"
              />
            </div>
          </SettingsCard>
        ) : (
          <SettingsCard className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="analysis-replicas">Parallel workers</Label>
              <p className="max-w-prose text-xs text-muted-foreground">
                Each worker loads its own copy of the analysis models — a few GB of RAM apiece.
                Applying a change scales the container live; the server rejects a count your host
                can&apos;t hold.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <div className="inline-flex items-center rounded-md border border-input">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-r-none"
                    disabled={scanInProgress || replicas <= 1}
                    onClick={() => setReplicasInput((n) => Math.max(1, n - 1))}
                    aria-label="Fewer workers"
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </Button>
                  <Input
                    id="analysis-replicas"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className="h-9 w-14 rounded-none border-x border-y-0 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    value={replicas}
                    disabled={scanInProgress}
                    onChange={(e) =>
                      setReplicasInput(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-l-none"
                    disabled={scanInProgress}
                    onClick={() => setReplicasInput((n) => n + 1)}
                    aria-label="More workers"
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant={replicasDirty ? 'default' : 'outline'}
                  disabled={isScaling || scanInProgress || !replicasDirty}
                  onClick={handleScale}
                >
                  {isScaling ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                  {replicasDirty ? 'Apply' : `${settings?.replicas ?? 1} running`}
                </Button>
              </div>
              <p className="max-w-prose text-xs text-muted-foreground">
                Worker count doesn&apos;t change how many analysis requests the backend sends at
                once — that still needs a backend restart.
              </p>
            </div>
          </SettingsCard>
        )}
      </SettingsBlock>

      {/* --- Enrichment --- */}
      <SettingsBlock
        title="Enrichment"
        description="Analysis works with none of these. Each key adds one capability on top."
      >
        <div className="space-y-3">
          {capabilities.map((cap) => (
            <CapabilityRow key={cap.id} cap={cap} disabled={isLoading} />
          ))}
        </div>

        <SettingsCard className="flex flex-wrap items-center gap-3">
          <SaveButton
            dirty={keysDirty}
            saving={isSavingApiKeys}
            onClick={handleSaveKeys}
            idleLabel="Keys saved"
          >
            Save keys
          </SaveButton>
          {settings?.mode === 'local' ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isApplyingApiKeys || scanInProgress || !hasLocalInstance}
              onClick={handleApplyKeys}
            >
              {isApplyingApiKeys ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-3.5" aria-hidden />
              )}
              Reload container now
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {settings?.mode === 'local'
              ? 'Saved keys load on the next scan or worker change. Reload now to pick them up immediately (~30–60s to reload models).'
              : 'Stored for when you switch to Local. A remote endpoint uses its own environment.'}
          </p>
        </SettingsCard>
      </SettingsBlock>
    </div>
  );
}

function EngineChoice({
  active,
  disabled,
  onClick,
  icon,
  title,
  body,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col gap-2 rounded-xl p-4 text-left shadow-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-60',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-card text-card-foreground hover:bg-accent',
      )}
    >
      <span className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
        {active ? <Check className="ml-auto size-4" aria-hidden /> : null}
      </span>
      <span
        className={cn(
          'text-xs leading-relaxed',
          active ? 'text-primary-foreground/85' : 'text-muted-foreground',
        )}
      >
        {body}
      </span>
    </button>
  );
}

function CapabilityRow({ cap, disabled }: { cap: Capability; disabled?: boolean }) {
  // "Configured" once every key the capability needs is stored and untouched.
  const configured = cap.fields.every((f) => f.stored && !f.value);
  return (
    <SettingsCard className="grid gap-4 sm:grid-cols-[1fr_minmax(0,20rem)] sm:items-start">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex size-5 shrink-0 items-center justify-center rounded-full',
              configured
                ? 'bg-success-surface text-success-foreground'
                : 'bg-muted text-muted-foreground',
            )}
            aria-hidden
          >
            {configured ? <Check className="size-3" /> : <Minus className="size-3" />}
          </span>
          <span className="font-medium">{cap.capability}</span>
        </div>
        <p className="pl-7 text-sm text-muted-foreground">{cap.detail}</p>
      </div>
      <div className="space-y-3">
        {cap.fields.map((f) => (
          <SecretField
            key={f.id}
            id={`analysis-key-${f.id}`}
            label={f.label}
            hint={f.hint}
            stored={f.stored}
            value={f.value}
            onChange={f.set}
            plainText={f.plainText}
            disabled={disabled}
          />
        ))}
      </div>
    </SettingsCard>
  );
}
