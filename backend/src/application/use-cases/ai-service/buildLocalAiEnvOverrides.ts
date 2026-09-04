import { AiServiceSettings } from 'src/kernel/types/model-types';

/**
 * Maps the third-party API keys stored on the ai-service settings row to the env-var names the
 * local ai-service container reads (see ai-service/src/services/*). Only non-empty values are
 * included -- an unset key must not overwrite whatever the container's baked-in env or
 * docker-compose.yml already provides.
 *
 * `DISCOGS_API_KEYS` is passed through verbatim (the service splits it on "," itself).
 */
export function buildLocalAiEnvOverrides(
  settings: Pick<
    AiServiceSettings,
    'geminiApiKey' | 'hfToken' | 'lastfmApiKey' | 'lastfmSecret' | 'discogsApiKeys'
  >,
): Record<string, string> {
  const pairs: [string, string | null | undefined][] = [
    ['GOOGLE_API_KEY', settings.geminiApiKey],
    ['HF_TOKEN', settings.hfToken],
    ['LAST_FM_API_KEY', settings.lastfmApiKey],
    ['LAST_FM_SECRET_KEY', settings.lastfmSecret],
    ['DISCOGS_API_KEYS', settings.discogsApiKeys],
  ];

  const out: Record<string, string> = {};
  for (const [key, value] of pairs) {
    if (value && value.trim() !== '') {
      out[key] = value;
    }
  }
  return out;
}
