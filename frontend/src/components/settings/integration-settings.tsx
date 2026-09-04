import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE_URL } from '@/lib/api-config';
import {
  useIntegrationSettings,
  useUpdateIntegrationSettings,
  type UpdateIntegrationSettingsInput,
} from '@/services/integration-settings-hooks';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface KeyField {
  id: keyof UpdateIntegrationSettingsInput;
  label: string;
  stored: boolean | undefined;
  /** Client IDs aren't really secret -- render as plain text. */
  secret?: boolean;
}

export function IntegrationSettings() {
  const { settings, isLoading, refetch } = useIntegrationSettings();
  const { updateSettings, isUpdating } = useUpdateIntegrationSettings();

  const [values, setValues] = useState<Record<string, string>>({});
  const set = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));

  const handleSave = async () => {
    const input: UpdateIntegrationSettingsInput = {};
    for (const [k, v] of Object.entries(values)) {
      if (v) (input as Record<string, string>)[k] = v;
    }
    if (Object.keys(input).length === 0) {
      toast.info('Nothing to save -- type a value into a field first.');
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

  const field = (f: KeyField) => (
    <div key={f.id} className="space-y-1.5">
      <Label htmlFor={`integration-${f.id}`}>
        {f.label}{' '}
        {f.stored && !values[f.id] ? (
          <span className="text-xs font-normal text-muted-foreground">
            (leave blank to keep current)
          </span>
        ) : null}
      </Label>
      <Input
        id={`integration-${f.id}`}
        type={f.secret === false ? 'text' : 'password'}
        autoComplete="off"
        placeholder={f.stored ? '••••••••' : ''}
        value={values[f.id] ?? ''}
        onChange={(e) => set(f.id, e.target.value)}
      />
    </div>
  );

  const providers: { name: string; console: string; fields: KeyField[] }[] = [
    {
      name: 'Spotify',
      console: 'https://developer.spotify.com/dashboard',
      fields: [
        { id: 'spotifyClientId', label: 'Client ID', stored: settings?.hasSpotifyClientId, secret: false },
        { id: 'spotifyClientSecret', label: 'Client secret', stored: settings?.hasSpotifyClientSecret },
      ],
    },
    {
      name: 'TIDAL',
      console: 'https://developer.tidal.com/dashboard',
      fields: [
        { id: 'tidalClientId', label: 'Client ID', stored: settings?.hasTidalClientId, secret: false },
        { id: 'tidalClientSecret', label: 'Client secret', stored: settings?.hasTidalClientSecret },
      ],
    },
    {
      name: 'YouTube',
      console: 'https://console.cloud.google.com/apis/credentials',
      fields: [
        { id: 'youtubeClientId', label: 'Client ID', stored: settings?.hasYoutubeClientId, secret: false },
        { id: 'youtubeClientSecret', label: 'Client secret', stored: settings?.hasYoutubeClientSecret },
      ],
    },
  ];

  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Integrations &amp; keys</h2>
        <p className="text-sm text-muted-foreground">
          Credentials Muzo&apos;s backend uses. Each falls back to its environment variable when
          left blank, so an existing setup keeps working.
        </p>
      </div>

      <div className="space-y-5 px-4 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="integration-cosineApiKey">
            cosine.club API key{' '}
            {settings?.hasCosineApiKey && !values.cosineApiKey ? (
              <span className="text-xs font-normal text-muted-foreground">
                (leave blank to keep current)
              </span>
            ) : null}
          </Label>
          <Input
            id="integration-cosineApiKey"
            type="password"
            autoComplete="off"
            placeholder={settings?.hasCosineApiKey ? '••••••••' : ''}
            value={values.cosineApiKey ?? ''}
            onChange={(e) => set('cosineApiKey', e.target.value)}
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Powers playlist discovery / similar tracks.{' '}
            <a
              href="https://cosine.club/account"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:no-underline"
            >
              Get a key
            </a>
          </p>
        </div>

        {providers.map((p) => (
          <div key={p.name} className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{p.name}</h3>
              <a
                href={p.console}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:no-underline"
              >
                Developer console
              </a>
            </div>
            {p.fields.map(field)}
          </div>
        ))}

        <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Redirect / callback URI to register with each provider:{' '}
          <code className="font-mono text-foreground">{API_BASE_URL}</code>
        </div>

        <Button size="sm" disabled={isUpdating || isLoading} onClick={handleSave}>
          {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
          Save credentials
        </Button>
      </div>
    </div>
  );
}
