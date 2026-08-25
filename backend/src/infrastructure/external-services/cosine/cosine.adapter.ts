import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CosineSimilarTrack,
  CosineTrack,
  ICosineProvider,
} from 'src/application/ports/infrastructure/ICosineProvider';

const BASE_URL = 'https://cosine.club/api/v1';

@Injectable()
export class CosineAdapter implements ICosineProvider {
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('COSINE_API_KEY') || '';
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
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  async searchTrack(artist: string, title: string): Promise<CosineTrack | null> {
    const query = new URLSearchParams({ q: `${artist} ${title}`, limit: '1' });
    const data = (await this.makeRequest(`/search?${query.toString()}`)) as {
      data?: { id: string; artist: string; track: string }[];
    } | null;
    const first = data?.data?.[0];
    if (!first) return null;
    return { id: first.id, artist: first.artist, title: first.track };
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
