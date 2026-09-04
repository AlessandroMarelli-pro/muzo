import {
  IIntegrationSettingsRepository,
  IntegrationSettingsUpdate,
} from 'src/application/ports/repositories/IIntegrationSettingsRepository';

export interface UpdateIntegrationSettingsResult {
  success: boolean;
  message: string;
}

/**
 * Persists third-party credentials the backend reads (cosine.club API key, Spotify/Tidal/YouTube
 * OAuth app creds). Write-only: the adapters resolve the current value on their next call, so
 * there is nothing to restart and no scan guard.
 */
export class UpdateIntegrationSettingsUseCase {
  constructor(private readonly repository: IIntegrationSettingsRepository) {}

  async execute(input: IntegrationSettingsUpdate): Promise<UpdateIntegrationSettingsResult> {
    await this.repository.save(input);
    return { success: true, message: 'Integration credentials saved.' };
  }
}
