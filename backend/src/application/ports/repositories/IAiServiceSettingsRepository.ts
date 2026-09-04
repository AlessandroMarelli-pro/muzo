import { AiServiceMode, AiServiceSettings } from 'src/kernel/types/model-types';
import { createToken } from '../../utils/create-token';

export interface AiServiceSettingsUpdate {
  mode?: AiServiceMode;
  remoteUrl?: string | null;
  /**
   * `undefined` (field omitted) -- leave the stored token unchanged.
   * `null` or `""` -- clear the stored token.
   * Any other string -- replace the stored token.
   * The UI never reads a token back, so "unchanged" must be the default rather than "wiped".
   */
  authToken?: string | null;
  replicas?: number;

  /**
   * Third-party API keys for the local ai-service. Same tri-state as `authToken`:
   * `undefined` -- leave unchanged; `null`/`""` -- clear; any other string -- replace.
   */
  geminiApiKey?: string | null;
  hfToken?: string | null;
  lastfmApiKey?: string | null;
  lastfmSecret?: string | null;
  discogsApiKeys?: string | null;
}

export const AI_SERVICE_SETTINGS_REPOSITORY = createToken<IAiServiceSettingsRepository>(
  'AI_SERVICE_SETTINGS_REPOSITORY',
);

export interface IAiServiceSettingsRepository {
  /** Reads the singleton row, creating it with defaults if it does not exist yet. */
  get(): Promise<AiServiceSettings>;

  /** Merges `update` into the singleton row (creating it first if needed) and returns the result. */
  save(update: AiServiceSettingsUpdate): Promise<AiServiceSettings>;
}
