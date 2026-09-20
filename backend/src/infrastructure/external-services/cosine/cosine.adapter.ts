import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CosineBulkSearchResult,
  CosineSimilarFilters,
  CosineSimilarTrack,
  CosineTrack,
  ICosineProvider,
} from 'src/application/ports/infrastructure/ICosineProvider';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import {
  IIntegrationSettingsRepository,
  INTEGRATION_SETTINGS_REPOSITORY,
} from 'src/application/ports/repositories/IIntegrationSettingsRepository';
import { normalizeForMatch } from 'src/application/use-cases/discovery/normalize-string';

const BASE_URL = 'https://cosine.club/api/v1';
const SEARCH_CANDIDATES_LIMIT = 10;

@Injectable()
export class CosineAdapter implements ICosineProvider {
  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
    @Inject(INTEGRATION_SETTINGS_REPOSITORY)
    private readonly integrationSettingsRepository: IIntegrationSettingsRepository,
  ) {
    this.logger = loggerFactory.createLogger('CosineAdapter');
  }

  /** Settings row wins; falls back to COSINE_API_KEY in the environment. */
  private async resolveApiKey(): Promise<string> {
    const settings = await this.integrationSettingsRepository.get();
    return settings.cosineApiKey || this.configService.get<string>('COSINE_API_KEY') || '';
  }

  private async makeRequest(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<unknown> {
    const apiKey = await this.resolveApiKey();
    if (!apiKey) return null;
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        method: init?.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'muzo/1.0',
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
      });
      this.logger.debug('Cosine API request', { path, status: response.status });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      this.logger.warn('Cosine API request failed', {
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private static appendFilterParams(query: URLSearchParams, filters?: CosineSimilarFilters): void {
    if (!filters) return;
    const entries: [string, number | undefined][] = [
      ['start_year', filters.startYear],
      ['end_year', filters.endYear],
      ['min_have', filters.minHave],
      ['max_have', filters.maxHave],
      ['min_want', filters.minWant],
      ['max_want', filters.maxWant],
      ['min_price', filters.minPrice],
      ['max_price', filters.maxPrice],
    ];
    for (const [key, value] of entries) {
      if (value !== undefined) query.set(key, value.toString());
    }
  }

  async searchTrack(artist: string, title: string): Promise<CosineTrack | null> {
    const query = new URLSearchParams({
      q: `${artist} ${title}`,
      limit: SEARCH_CANDIDATES_LIMIT.toString(),
    });
    const data = (await this.makeRequest(`/search?${query.toString()}`)) as {
      data?: { id: string; artist: string; track: string }[];
    } | null;
    const results = data?.data ?? [];
    const normalizedArtist = normalizeForMatch(artist);
    const normalizedTitle = normalizeForMatch(title);
    const strictMatch = results.find(
      (result) =>
        normalizeForMatch(result.artist) === normalizedArtist &&
        normalizeForMatch(result.track) === normalizedTitle,
    );

    this.logger.debug('Cosine search result', {
      artist,
      title,
      resultCount: results.length,
      matched: Boolean(strictMatch),
    });

    if (!strictMatch) return null;

    return { id: strictMatch.id, artist: strictMatch.artist, title: strictMatch.track };
  }

  async lookupTrackByUrl(url: string): Promise<CosineTrack | null> {
    const query = new URLSearchParams({ url });
    const data = (await this.makeRequest(`/tracks/lookup?${query.toString()}`)) as {
      data?: { id: string; artist: string; track: string }[];
    } | null;
    const results = data?.data ?? [];
    const firstMatch = results[0];

    this.logger.debug('Cosine URL lookup result', {
      url,
      resultCount: results.length,
      matched: Boolean(firstMatch),
    });

    if (!firstMatch) return null;

    return { id: firstMatch.id, artist: firstMatch.artist, title: firstMatch.track };
  }

  async getSimilarTracks(
    trackId: string,
    limit = 20,
    filters?: CosineSimilarFilters,
  ): Promise<CosineSimilarTrack[]> {
    const query = new URLSearchParams({ limit: limit.toString() });
    CosineAdapter.appendFilterParams(query, filters);
    const data = (await this.makeRequest(`/tracks/${trackId}/similar?${query.toString()}`)) as {
      data?: {
        similar_tracks?: RawCosineTrack[];
      };
    } | null;
    const similarTracks = data?.data?.similar_tracks ?? [];

    this.logger.debug('Cosine similar tracks result', {
      trackId,
      similarTrackCount: similarTracks.length,
    });

    return similarTracks.map(toDomainSimilarTrack);
  }

  async bulkSearch(
    tracks: string[],
    filters?: CosineSimilarFilters & { similarLimit?: number },
  ): Promise<CosineBulkSearchResult> {
    const body: Record<string, unknown> = { tracks };
    if (filters?.similarLimit !== undefined) body.similar_limit = filters.similarLimit;
    if (filters?.startYear !== undefined) body.start_year = filters.startYear;
    if (filters?.endYear !== undefined) body.end_year = filters.endYear;
    if (filters?.minHave !== undefined) body.min_have = filters.minHave;
    if (filters?.maxHave !== undefined) body.max_have = filters.maxHave;
    if (filters?.minWant !== undefined) body.min_want = filters.minWant;
    if (filters?.maxWant !== undefined) body.max_want = filters.maxWant;
    if (filters?.minPrice !== undefined) body.min_price = filters.minPrice;
    if (filters?.maxPrice !== undefined) body.max_price = filters.maxPrice;

    const data = (await this.makeRequest('/search/bulk', { method: 'POST', body })) as {
      data?: {
        results?: {
          query: string;
          track: RawCosineTrack;
          similar_tracks: RawCosineTrack[];
        }[];
        unmatched?: string[];
      };
    } | null;

    const results = data?.data?.results ?? [];
    const unmatched = data?.data?.unmatched ?? [];

    this.logger.debug('Cosine bulk search result', {
      trackCount: tracks.length,
      matchedCount: results.length,
      unmatchedCount: unmatched.length,
    });

    return {
      matched: results.map((r) => ({
        query: r.query,
        track: { id: r.track.id, artist: r.track.artist, title: r.track.track },
        similarTracks: r.similar_tracks.map(toDomainSimilarTrack),
      })),
      unmatched,
    };
  }
}

type RawCosineTrack = {
  id: string;
  artist: string;
  track: string;
  score: number;
  video_id?: string;
  external_link?: string;
};

function toDomainSimilarTrack(t: RawCosineTrack): CosineSimilarTrack {
  return {
    id: t.id,
    artist: t.artist,
    title: t.track,
    score: t.score,
    videoId: t.video_id,
    externalLink: t.external_link,
  };
}
