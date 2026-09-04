import { IIntegrationSettingsRepository } from 'src/application/ports/repositories/IIntegrationSettingsRepository';

export interface IntegrationSettingsView {
  // Whether each credential is stored -- never the value. The UI can't read a secret back.
  hasCosineApiKey: boolean;
  hasSpotifyClientId: boolean;
  hasSpotifyClientSecret: boolean;
  hasTidalClientId: boolean;
  hasTidalClientSecret: boolean;
  hasYoutubeClientId: boolean;
  hasYoutubeClientSecret: boolean;
}

export class GetIntegrationSettingsUseCase {
  constructor(private readonly repository: IIntegrationSettingsRepository) {}

  async execute(): Promise<IntegrationSettingsView> {
    const s = await this.repository.get();
    return {
      hasCosineApiKey: !!s.cosineApiKey,
      hasSpotifyClientId: !!s.spotifyClientId,
      hasSpotifyClientSecret: !!s.spotifyClientSecret,
      hasTidalClientId: !!s.tidalClientId,
      hasTidalClientSecret: !!s.tidalClientSecret,
      hasYoutubeClientId: !!s.youtubeClientId,
      hasYoutubeClientSecret: !!s.youtubeClientSecret,
    };
  }
}
