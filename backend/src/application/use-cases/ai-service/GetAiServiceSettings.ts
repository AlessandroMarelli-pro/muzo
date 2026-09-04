import { IAiServicePool } from 'src/application/ports/infrastructure/IAiServicePool';
import { IAiServiceSettingsRepository } from 'src/application/ports/repositories/IAiServiceSettingsRepository';
import { AiServiceMode } from 'src/kernel/types/model-types';

export interface AiServiceSettingsView {
  mode: AiServiceMode;
  remoteUrl: string | null;
  /** Whether a token is stored, never the token itself -- the UI can't read a secret back. */
  hasAuthToken: boolean;
  replicas: number;
  health: any;
  // Whether each third-party API key is stored -- never the value.
  hasGeminiApiKey: boolean;
  hasHfToken: boolean;
  hasLastfmApiKey: boolean;
  hasLastfmSecret: boolean;
  hasDiscogsApiKeys: boolean;
}

export class GetAiServiceSettingsUseCase {
  constructor(
    private readonly settingsRepository: IAiServiceSettingsRepository,
    private readonly aiServicePool: IAiServicePool,
  ) {}

  async execute(): Promise<AiServiceSettingsView> {
    const [settings, health] = await Promise.all([
      this.settingsRepository.get(),
      this.aiServicePool.getHealthInfo(),
    ]);

    return {
      mode: settings.mode,
      remoteUrl: settings.remoteUrl,
      hasAuthToken: !!settings.authToken,
      replicas: settings.replicas,
      health,
      hasGeminiApiKey: !!settings.geminiApiKey,
      hasHfToken: !!settings.hfToken,
      hasLastfmApiKey: !!settings.lastfmApiKey,
      hasLastfmSecret: !!settings.lastfmSecret,
      hasDiscogsApiKeys: !!settings.discogsApiKeys,
    };
  }
}
