import {
  SaveButton,
  SecretField,
  SettingsBlock,
  SettingsCard,
} from '@/components/settings/settings-primitives';
import { useSectionDirty } from '@/components/settings/use-settings-dirty';
import {
  useIntegrationSettings,
  useUpdateIntegrationSettings,
} from '@/services/integration-settings-hooks';
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * "Discovery" — cosine.club powers playlist discovery and the "similar tracks"
 * recommendations computed over the collection. One key, its own section, so it
 * isn't buried next to the streaming credentials it has nothing to do with.
 */
export function SectionDiscovery() {
  const { settings, isLoading, refetch } = useIntegrationSettings();
  const { updateSettings, isUpdating } = useUpdateIntegrationSettings();

  const [cosineApiKey, setCosineApiKey] = useState('');
  const dirty = !!cosineApiKey;
  useSectionDirty('discovery', dirty);

  const handleSave = async () => {
    if (!cosineApiKey) {
      toast.info('Nothing to save — paste a key first.');
      return;
    }
    try {
      const result = await updateSettings({ cosineApiKey });
      if (result.success) {
        toast.success(result.message);
        setCosineApiKey('');
        refetch();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(`Failed to save: ${error?.message || 'Unknown error'}`);
    }
  };

  return (
    <SettingsBlock
      title="Discovery"
      description="Playlist discovery and similar-track recommendations are computed from your own collection via cosine.club."
      action={
        <SaveButton
          dirty={dirty}
          saving={isUpdating}
          disabled={isLoading}
          onClick={handleSave}
          idleLabel="Key saved"
        >
          Save key
        </SaveButton>
      }
    >
      <SettingsCard className="max-w-xl">
        <SecretField
          id="discovery-cosine"
          label="cosine.club API key"
          stored={settings?.hasCosineApiKey}
          value={cosineApiKey}
          onChange={setCosineApiKey}
          disabled={isLoading}
          hint={
            <>
              Grab one from your{' '}
              <a
                href="https://cosine.club/account"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:no-underline"
              >
                cosine.club account
              </a>
              . Without it, discovery and similar tracks are unavailable.
            </>
          }
        />
      </SettingsCard>
    </SettingsBlock>
  );
}
