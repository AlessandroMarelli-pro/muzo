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
