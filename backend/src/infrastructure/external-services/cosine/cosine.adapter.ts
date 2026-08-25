import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import {
  CosineSimilarTrack,
  CosineTrack,
  ICosineProvider,
} from 'src/application/ports/infrastructure/ICosineProvider';
import { normalizeForMatch } from 'src/application/use-cases/discovery/normalize-string';

const BASE_URL = 'https://cosine.club/api/v1';
const SEARCH_CANDIDATES_LIMIT = 10;

@Injectable()
export class CosineAdapter implements ICosineProvider {
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.apiKey = this.configService.get<string>('COSINE_API_KEY') || '';
    this.logger = loggerFactory.createLogger('CosineAdapter');
  }

  private async makeRequest(path: string): Promise<unknown> {
    if (!this.apiKey) return null;
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': 'muzo/1.0',
        },
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

  async getSimilarTracks(trackId: string, limit = 20): Promise<CosineSimilarTrack[]> {
    const query = new URLSearchParams({ limit: limit.toString() });
    const data = (await this.makeRequest(`/tracks/${trackId}/similar?${query.toString()}`)) as {
      data?: {
        similar_tracks?: {
          id: string;
          artist: string;
          track: string;
          score: number;
          video_id?: string;
          external_link?: string;
        }[];
      };
    } | null;
    const similarTracks = data?.data?.similar_tracks ?? [];

    this.logger.debug('Cosine similar tracks result', {
      trackId,
      similarTrackCount: similarTracks.length,
    });

    return similarTracks.map((t) => ({
      id: t.id,
      artist: t.artist,
      title: t.track,
      score: t.score,
      videoId: t.video_id,
      externalLink: t.external_link,
    }));
  }
}
