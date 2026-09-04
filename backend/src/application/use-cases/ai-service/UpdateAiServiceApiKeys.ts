import { IAiServiceSettingsRepository } from 'src/application/ports/repositories/IAiServiceSettingsRepository';

export interface UpdateAiServiceApiKeysInput {
  /** Each field: `undefined` = leave unchanged; `""` = clear; a string = replace. */
  geminiApiKey?: string;
  hfToken?: string;
  lastfmApiKey?: string;
  lastfmSecret?: string;
  discogsApiKeys?: string;
}

export interface UpdateAiServiceApiKeysResult {
  success: boolean;
  message: string;
}

/**
 * Persists the third-party API keys for the local ai-service. Write-only: it never touches a
 * running container (that is ApplyAiServiceApiKeysUseCase), so it is safe to call mid-scan and
 * has no scan guard. The keys reach a local container on the next Apply, `docker compose up`,
 * or replica change.
 */
export class UpdateAiServiceApiKeysUseCase {
  constructor(private readonly settingsRepository: IAiServiceSettingsRepository) {}

  async execute(input: UpdateAiServiceApiKeysInput): Promise<UpdateAiServiceApiKeysResult> {
    await this.settingsRepository.save({
      ...(input.geminiApiKey !== undefined && { geminiApiKey: input.geminiApiKey }),
      ...(input.hfToken !== undefined && { hfToken: input.hfToken }),
      ...(input.lastfmApiKey !== undefined && { lastfmApiKey: input.lastfmApiKey }),
      ...(input.lastfmSecret !== undefined && { lastfmSecret: input.lastfmSecret }),
      ...(input.discogsApiKeys !== undefined && { discogsApiKeys: input.discogsApiKeys }),
    });

    const settings = await this.settingsRepository.get();
    const message =
      settings.mode === 'local'
        ? "Keys saved. Click 'Apply to running container' to load them now, or they'll apply on the next restart or replica change."
        : "Keys saved. In remote mode they're only used if you also run local mode, or your endpoint reads them itself.";

    return { success: true, message };
  }
}
