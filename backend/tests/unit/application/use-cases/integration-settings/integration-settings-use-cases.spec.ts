import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetIntegrationSettingsUseCase } from 'src/application/use-cases/integration-settings/GetIntegrationSettings';
import { UpdateIntegrationSettingsUseCase } from 'src/application/use-cases/integration-settings/UpdateIntegrationSettings';

describe('GetIntegrationSettingsUseCase', () => {
  it('returns has* booleans, never the values', async () => {
    const repo = {
      get: vi.fn().mockResolvedValue({
        cosineApiKey: 'secret',
        spotifyClientId: 'id',
        spotifyClientSecret: null,
        tidalClientId: null,
        tidalClientSecret: null,
        youtubeClientId: null,
        youtubeClientSecret: null,
      }),
    };
    const view = await new GetIntegrationSettingsUseCase(repo as any).execute();

    expect(view).toEqual({
      hasCosineApiKey: true,
      hasSpotifyClientId: true,
      hasSpotifyClientSecret: false,
      hasTidalClientId: false,
      hasTidalClientSecret: false,
      hasYoutubeClientId: false,
      hasYoutubeClientSecret: false,
    });
    // no secret leaks into the view
    expect(JSON.stringify(view)).not.toContain('secret');
  });
});

describe('UpdateIntegrationSettingsUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards the input to the repository verbatim (tri-state handled downstream)', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const result = await new UpdateIntegrationSettingsUseCase({ save } as any).execute({
      cosineApiKey: 'k',
      tidalClientId: '',
    });

    expect(save).toHaveBeenCalledWith({ cosineApiKey: 'k', tidalClientId: '' });
    expect(result.success).toBe(true);
  });
});
