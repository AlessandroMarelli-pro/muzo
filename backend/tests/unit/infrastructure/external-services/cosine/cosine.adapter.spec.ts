import { ConfigService } from '@nestjs/config';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import type { IIntegrationSettingsRepository } from 'src/application/ports/repositories/IIntegrationSettingsRepository';
import { CosineAdapter } from 'src/infrastructure/external-services/cosine/cosine.adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const noopLogger: ILogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as ILogger;

function makeAdapter(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock);

  const configService = { get: vi.fn(() => 'env-key') } as unknown as ConfigService;
  const loggerFactory = { createLogger: () => noopLogger };
  const integrationSettingsRepository = {
    get: vi.fn(async () => ({ cosineApiKey: 'settings-key' })),
  } as unknown as IIntegrationSettingsRepository;

  return new CosineAdapter(
    configService,
    loggerFactory,
    noopLogger,
    integrationSettingsRepository,
  );
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe('CosineAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getSimilarTracks', () => {
    it('sends limit and only the defined filter params', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { similar_tracks: [] } }));
      const adapter = makeAdapter(fetchMock);

      await adapter.getSimilarTracks('track-1', 15, { startYear: 2000, minHave: 5 });

      const [url] = fetchMock.mock.calls[0];
      const query = new URL(url).searchParams;
      expect(query.get('limit')).toBe('15');
      expect(query.get('start_year')).toBe('2000');
      expect(query.get('min_have')).toBe('5');
      expect(query.has('end_year')).toBe(false);
      expect(query.has('max_price')).toBe(false);
    });

    it('maps similar_tracks to domain shape', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            similar_tracks: [
              {
                id: '264028',
                artist: 'Julio Bashmore',
                track: 'Battle For Middle You',
                score: 0.87,
                video_id: 'kZOA4dysxDc',
                external_link: 'https://discogs.com/release/2685751',
              },
            ],
          },
        }),
      );
      const adapter = makeAdapter(fetchMock);

      const result = await adapter.getSimilarTracks('track-1');

      expect(result).toEqual([
        {
          id: '264028',
          artist: 'Julio Bashmore',
          title: 'Battle For Middle You',
          score: 0.87,
          videoId: 'kZOA4dysxDc',
          externalLink: 'https://discogs.com/release/2685751',
        },
      ]);
    });
  });

  describe('bulkSearch', () => {
    it('POSTs tracks and filters as a JSON body', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ data: { results: [], unmatched: [] } }));
      const adapter = makeAdapter(fetchMock);

      await adapter.bulkSearch(['Joy Orbison - Hyph Mngo'], { similarLimit: 10, endYear: 2020 });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://cosine.club/api/v1/search/bulk');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({
        tracks: ['Joy Orbison - Hyph Mngo'],
        similar_limit: 10,
        end_year: 2020,
      });
    });

    it('maps matched results and unmatched queries to domain shape', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            results: [
              {
                query: 'Joy Orbison - Hyph Mngo',
                track: { id: '185450', artist: 'Joy Orbison', track: 'Hyph Mngo' },
                similar_tracks: [
                  {
                    id: '264028',
                    artist: 'Julio Bashmore',
                    track: 'Battle For Middle You',
                    score: 0.87,
                  },
                ],
              },
            ],
            unmatched: ['Unknown Artist - Unknown Track'],
          },
        }),
      );
      const adapter = makeAdapter(fetchMock);

      const result = await adapter.bulkSearch(['Joy Orbison - Hyph Mngo', 'Unknown Artist - Unknown Track']);

      expect(result).toEqual({
        matched: [
          {
            query: 'Joy Orbison - Hyph Mngo',
            track: { id: '185450', artist: 'Joy Orbison', title: 'Hyph Mngo' },
            similarTracks: [
              {
                id: '264028',
                artist: 'Julio Bashmore',
                title: 'Battle For Middle You',
                score: 0.87,
                videoId: undefined,
                externalLink: undefined,
              },
            ],
          },
        ],
        unmatched: ['Unknown Artist - Unknown Track'],
      });
    });

    it('returns empty matched/unmatched when the request fails', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      const adapter = makeAdapter(fetchMock);

      const result = await adapter.bulkSearch(['Joy Orbison - Hyph Mngo']);

      expect(result).toEqual({ matched: [], unmatched: [] });
    });
  });
});
