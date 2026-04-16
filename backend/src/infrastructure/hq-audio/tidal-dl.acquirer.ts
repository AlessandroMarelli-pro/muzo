import { Inject, Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  HqAudioAcquireResult,
  IHqAudioAcquirer,
} from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import {
  ITidalSyncProvider,
  TIDAL_SYNC_PROVIDER,
} from 'src/application/ports/infrastructure/ITidalSyncProvider';
import { getCurrentUserId } from 'src/kernel/types/context';

@Injectable()
export class TidalDlAcquirer implements IHqAudioAcquirer {
  constructor(
    @Inject(TIDAL_SYNC_PROVIDER)
    private readonly tidalSyncProvider: ITidalSyncProvider,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('TidalDlAcquirer');
  }

  private normalizeForMatch(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async listAudioFiles(rootDir: string): Promise<string[]> {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
          return this.listAudioFiles(entryPath);
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.flac' || ext === '.wav') {
          return [entryPath];
        }
        return [];
      }),
    );
    return nested.flat();
  }

  private async runTidalDownload(trackId: string, outputDir: string): Promise<void> {
    const trackUrl = `https://tidal.com/browse/track/${trackId}`;
    const args = ['dl', trackUrl, '--output-path', outputDir];
    await fs.mkdir(outputDir, { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const cmd = spawn('tidal-dl-ng', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      cmd.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      cmd.on('error', (error) => reject(error));
      cmd.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`tidal-dl-ng failed with code ${code}: ${stderr}`));
      });
    });
  }

  async acquire(
    artist: string,
    title: string,
    durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    const userId = getCurrentUserId();
    const match = await this.tidalSyncProvider.findBestMatch(artist, title, durationSeconds, userId);
    if (!match.trackId) {
      return null;
    }

    await this.runTidalDownload(match.trackId, outputDir);
    const files = await this.listAudioFiles(outputDir);
    if (files.length === 0) {
      return null;
    }

    const normalizedArtist = this.normalizeForMatch(artist);
    const normalizedTitle = this.normalizeForMatch(title);
    const bestCandidate = files.find((filePath) => {
      const normalizedPath = this.normalizeForMatch(filePath);
      return normalizedPath.includes(normalizedArtist) && normalizedPath.includes(normalizedTitle);
    });

    const selected = bestCandidate ?? files[files.length - 1];
    const ext = path.extname(selected).toLowerCase();
    return {
      filePath: selected,
      format: ext === '.wav' ? 'wav' : 'flac',
    };
  }
}
