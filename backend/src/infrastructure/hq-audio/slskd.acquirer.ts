import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import {
  HqAudioAcquireResult,
  IHqAudioAcquirer,
} from 'src/application/ports/infrastructure/IHqAudioAcquirer';

type SlskdSearchResponse = {
  id: string;
};

type SlskdSearchResult = {
  id?: string;
  filename?: string;
  size?: number;
  username?: string;
};

@Injectable()
export class SlskdAcquirer implements IHqAudioAcquirer {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly downloadPath: string;
  private readonly searchTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('hqAudio.slskd.url') ?? 'http://localhost:5030';
    this.apiKey = this.configService.get<string>('hqAudio.slskd.apiKey') ?? '';
    this.downloadPath = this.configService.get<string>('hqAudio.slskd.downloadPath') ?? '';
    this.searchTimeoutMs = this.configService.get<number>('hqAudio.slskd.searchTimeoutMs') ?? 30000;
  }

  private headers(): Record<string, string> {
    return this.apiKey
      ? { 'X-API-Key': this.apiKey, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isLossless(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ext === '.flac' || ext === '.wav';
  }

  private chooseBest(results: SlskdSearchResult[]): SlskdSearchResult | null {
    const filtered = results.filter(
      (result) => result.filename && this.isLossless(result.filename) && result.id,
    );
    if (!filtered.length) {
      return null;
    }
    return filtered.sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0];
  }

  async acquire(
    artist: string,
    title: string,
    _durationSeconds: number,
    _outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    const query = `${artist} ${title} flac wav`;
    const searchResponse = await fetch(`${this.baseUrl}/api/v0/searches`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ searchText: query }),
    });
    if (!searchResponse.ok) {
      return null;
    }
    const search = (await searchResponse.json()) as SlskdSearchResponse;
    if (!search.id) {
      return null;
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < this.searchTimeoutMs) {
      await this.delay(2000);
      const res = await fetch(`${this.baseUrl}/api/v0/searches/${search.id}`, {
        method: 'GET',
        headers: this.headers(),
      });
      if (!res.ok) {
        continue;
      }
      const payload = (await res.json()) as { responses?: Array<{ files?: SlskdSearchResult[] }> };
      const candidates = payload.responses?.flatMap((response) => response.files ?? []) ?? [];
      const best = this.chooseBest(candidates);
      if (!best || !best.id || !best.username || !best.filename) {
        continue;
      }

      const downloadRes = await fetch(`${this.baseUrl}/api/v0/transfers/downloads`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          username: best.username,
          fileId: best.id,
        }),
      });
      if (!downloadRes.ok) {
        return null;
      }

      const ext = path.extname(best.filename).toLowerCase();
      return {
        filePath: this.downloadPath ? path.join(this.downloadPath, best.filename) : best.filename,
        format: ext === '.wav' ? 'wav' : 'flac',
      };
    }

    return null;
  }
}
