import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { HqQualityTier } from 'src/config/hq-audio.config';
import { getCurrentUserId } from 'src/kernel/types/context';
import { normalizeForMatch } from './match';

@Injectable()
export class TidalDlAcquirer implements IHqAudioAcquirer {
  private readonly defaultOutputDir: string;
  private readonly qualityTier: HqQualityTier;

  constructor(
    @Inject(TIDAL_SYNC_PROVIDER)
    private readonly tidalSyncProvider: ITidalSyncProvider,
    private readonly configService: ConfigService,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('TidalDlAcquirer');
    this.defaultOutputDir = this.configService.get<string>('hqAudio.tidal.outputDir') ?? '';
    this.qualityTier = this.configService.get<HqQualityTier>('hqAudio.qualityTier') ?? 'lossless';
  }

  /** tidal-dl-ng has no per-download quality flag; set it via `cfg` before `dl`. */
  private tidalQualityValue(): string {
    return this.qualityTier === 'hires' ? 'HI_RES_LOSSLESS' : 'LOSSLESS';
  }

  private runTidalCli(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
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
        reject(new Error(`tidal-dl-ng ${args[0]} failed with code ${code}: ${stderr}`));
      });
    });
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
        if (ext === '.flac' || ext === '.wav' || ext === '.m4a') {
          return [entryPath];
        }
        return [];
      }),
    );
    return nested.flat();
  }

  private async runTidalDownload(trackId: string, outputDir: string): Promise<void> {
    const trackUrl = `https://tidal.com/browse/track/${trackId}`;
    await fs.mkdir(outputDir, { recursive: true });

    // Apply the configured quality tier (best-effort: a cfg failure must not
    // block the download, which falls back to whatever quality_audio is set to).
    try {
      await this.runTidalCli(['cfg', 'quality_audio', this.tidalQualityValue()]);
    } catch (error) {
      this.logger.warn('Failed to set tidal-dl-ng quality, using existing config', {
        quality: this.tidalQualityValue(),
        error: String(error),
      });
    }

    await this.runTidalCli(['dl', trackUrl]);
  }

  async acquire(
    artist: string,
    title: string,
    durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    const resolvedOutputDir = outputDir || this.defaultOutputDir;
    const userId = getCurrentUserId();
    this.logger.info('Tidal search starting', { artist, title, durationSeconds });

    const match = await this.tidalSyncProvider.findBestMatch(artist, title, durationSeconds, userId);
    this.logger.info('Tidal search result', {
      artist,
      title,
      trackId: match.trackId,
      confidence: match.confidence,
      matchedArtist: match.matchedTrack?.artist,
      matchedTitle: match.matchedTrack?.title,
    });
    if (!match.trackId) {
      this.logger.warn('Tidal search found no match', { artist, title });
      return null;
    }

    const filesBefore = new Set(await this.listAudioFiles(resolvedOutputDir));

    this.logger.info('Tidal download starting', {
      artist,
      title,
      trackId: match.trackId,
      outputDir: resolvedOutputDir,
      existingFileCount: filesBefore.size,
    });
    await this.runTidalDownload(match.trackId, resolvedOutputDir);

    const files = await this.listAudioFiles(resolvedOutputDir);
    const newFiles = files.filter((filePath) => !filesBefore.has(filePath));
    this.logger.info('Tidal output directory scanned', {
      artist,
      title,
      outputDir: resolvedOutputDir,
      fileCount: files.length,
      newFileCount: newFiles.length,
    });
    if (files.length === 0) {
      this.logger.warn('tidal-dl-ng reported success but no audio files found in output directory', {
        artist,
        title,
        outputDir: resolvedOutputDir,
      });
      return null;
    }

    const normalizedArtist = normalizeForMatch(artist);
    const normalizedTitle = normalizeForMatch(title);
    const matchesArtistAndTitle = (filePath: string): boolean => {
      const normalizedPath = normalizeForMatch(filePath);
      return normalizedPath.includes(normalizedArtist) && normalizedPath.includes(normalizedTitle);
    };

    // Prefer a newly downloaded file (deterministic, scales regardless of library size).
    // Fall back to a text match across the whole directory only when nothing new appeared,
    // e.g. tidal-dl-ng skipped because the track was already downloaded in a prior run.
    const bestCandidate =
      (newFiles.length === 1 ? newFiles[0] : newFiles.find(matchesArtistAndTitle)) ??
      files.find(matchesArtistAndTitle);

    if (!bestCandidate) {
      this.logger.warn('Downloaded via tidal-dl-ng but no matching file found in output directory', {
        artist,
        title,
        outputDir: resolvedOutputDir,
        scannedFileCount: files.length,
        newFileCount: newFiles.length,
      });
      return null;
    }

    const ext = path.extname(bestCandidate).toLowerCase();
    const format = ext === '.wav' ? 'wav' : ext === '.m4a' ? 'm4a' : 'flac';
    this.logger.info('Tidal acquisition matched file', {
      artist,
      title,
      filePath: bestCandidate,
      format,
      resolvedVia: newFiles.includes(bestCandidate) ? 'new-file-diff' : 'text-match-fallback',
    });
    return {
      filePath: bestCandidate,
      format,
    };
  }
}
