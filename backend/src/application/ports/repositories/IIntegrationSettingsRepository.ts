import { IntegrationSettings } from 'src/kernel/types/model-types';
import { createToken } from '../../utils/create-token';

export interface IntegrationSettingsUpdate {
  /**
   * Each field: `undefined` (omitted) -- leave unchanged; `null`/`""` -- clear (falls back to
   * the env var); any other string -- replace. Never read back to the UI.
   */
  cosineApiKey?: string | null;
  spotifyClientId?: string | null;
  spotifyClientSecret?: string | null;
  tidalClientId?: string | null;
  tidalClientSecret?: string | null;
  youtubeClientId?: string | null;
  youtubeClientSecret?: string | null;
}

export const INTEGRATION_SETTINGS_REPOSITORY = createToken<IIntegrationSettingsRepository>(
  'INTEGRATION_SETTINGS_REPOSITORY',
);

export interface IIntegrationSettingsRepository {
  /** Reads the singleton row, creating it with all-null defaults if it does not exist yet. */
  get(): Promise<IntegrationSettings>;

  /** Merges `update` into the singleton row (creating it first if needed) and returns the result. */
  save(update: IntegrationSettingsUpdate): Promise<IntegrationSettings>;
}
