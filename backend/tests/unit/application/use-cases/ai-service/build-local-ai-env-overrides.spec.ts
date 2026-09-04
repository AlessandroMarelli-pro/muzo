import { describe, expect, it } from 'vitest';
import { buildLocalAiEnvOverrides } from 'src/application/use-cases/ai-service/buildLocalAiEnvOverrides';

describe('buildLocalAiEnvOverrides', () => {
  it('maps each stored key to its ai-service env var', () => {
    expect(
      buildLocalAiEnvOverrides({
        geminiApiKey: 'g',
        hfToken: 'h',
        lastfmApiKey: 'lk',
        lastfmSecret: 'ls',
        discogsApiKeys: 'd1,d2',
      }),
    ).toEqual({
      GOOGLE_API_KEY: 'g',
      HF_TOKEN: 'h',
      LAST_FM_API_KEY: 'lk',
      LAST_FM_SECRET_KEY: 'ls',
      DISCOGS_API_KEYS: 'd1,d2',
    });
  });

  it('omits keys that are null, undefined, or blank', () => {
    expect(
      buildLocalAiEnvOverrides({
        geminiApiKey: 'g',
        hfToken: null,
        lastfmApiKey: undefined as unknown as null,
        lastfmSecret: '   ',
        discogsApiKeys: '',
      }),
    ).toEqual({ GOOGLE_API_KEY: 'g' });
  });

  it('returns an empty object when nothing is set', () => {
    expect(
      buildLocalAiEnvOverrides({
        geminiApiKey: null,
        hfToken: null,
        lastfmApiKey: null,
        lastfmSecret: null,
        discogsApiKeys: null,
      }),
    ).toEqual({});
  });
});
