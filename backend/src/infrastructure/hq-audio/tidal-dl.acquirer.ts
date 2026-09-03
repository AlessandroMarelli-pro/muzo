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
import { probeAudioCodec } from './audio-probe';
import { normalizeForMatch } from './match';

export interface TidalMatch {
  trackId: string;
  matchedArtist?: string;
  matchedTitle?: string;
  /** The artist/title we searched with — used to disambiguate the output file. */
  queryArtist: string;
  queryTitle: string;
}

@Injectable()
export class TidalDlAcquirer implements IHqAudioAcquirer {
  private readonly defaultOutputDir: string;
  private readonly qualityTier: HqQualityTier;

  /**
   * Serialises `tidal-dl-ng dl` across concurrent callers: every download awaits
   * (and extends) this chain, so only one CLI process runs at a time. Without
   * this, parallel downloads into the shared Tidal dir race the before/after
   * file diff and get mis-assigned to the wrong track.
   */
  private downloadChain: Promise<unknown> = Promise.resolve();

  /** Runs `cfg quality_audio` at most once per process. */
  private qualityConfigured?: Promise<void>;

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

  private ensureQualityConfigured(): Promise<void> {
    if (!this.qualityConfigured) {
      this.qualityConfigured = this.runTidalCli([
        'cfg',
        'quality_audio',
        this.tidalQualityValue(),
      ]).catch((error) => {
        this.logger.warn('Failed to set tidal-dl-ng quality, using existing config', {
          quality: this.tidalQualityValue(),
          error: String(error),
        });
      });
    }
    return this.qualityConfigured;
  }

  private async listAudioFiles(rootDir: string): Promise<string[]> {
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(rootDir, { withFileTypes: true });
    } catch {
      return [];
    }
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

  /** Pure Tidal API search — safe to run in parallel. */
  async findMatch(
    artist: string,
    title: string,
    durationSeconds: number,
  ): Promise<TidalMatch | null> {
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
    return {
      trackId: match.trackId,
      matchedArtist: match.matchedTrack?.artist,
      matchedTitle: match.matchedTrack?.title,
      queryArtist: artist,
      queryTitle: title,
    };
  }

  private async runTidalDownload(trackId: string, outputDir: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });
    await this.ensureQualityConfigured();
    await this.runTidalCli(['dl', `https://tidal.com/browse/track/${trackId}`]);
  }

  /**
   * `tidal-dl-ng` names files `Tracks/{artist} - {title}[ (Explicit)].{ext}` from
   * Tidal's own metadata. A prior run (or a crash between download and DB write)
   * can leave that file on disk with no `hqAudioPath`. Look for it before
   * spawning the CLI: matching the basename against exactly that template using
   * Tidal's own metadata is tight enough to be safe, and skipping the download
   * makes re-runs cheap. The download step's looser substring match is kept only
   * for the post-download `skip_existing` case.
   */
  private async findExistingDownload(
    match: TidalMatch,
    dir: string,
  ): Promise<HqAudioAcquireResult | null> {
    // `tidal-dl-ng`'s `format_track` is "Tracks/{artist} - {title}[ (Explicit)]".
    // Match the file's basename against exactly that shape using Tidal's own
    // metadata, so a different track can't be adopted by accident.
    const wantArtist = normalizeForMatch(match.matchedArtist ?? match.queryArtist);
    const wantTitle = normalizeForMatch(match.matchedTitle ?? match.queryTitle);
    if (!wantArtist || !wantTitle) {
      return null;
    }

    // Normalize both sides the same way and collapse the "_" that pathvalidate
    // substitutes for invalid chars, so a sanitized filename still lines up.
    const canon = (s: string) => normalizeForMatch(s).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    const wanted = `${canon(wantArtist)} ${canon(wantTitle)}`;

    const files = await this.listAudioFiles(dir);
    const candidate = files.find((filePath) => {
      const stem = canon(path.basename(filePath, path.extname(filePath)));
      // Anchored prefix: "{artist} {title}" then only an optional " explicit"
      // (tidal-dl-ng's format_track suffix). No partial-word matches.
      return stem === wanted || stem === `${wanted} explicit`;
    });
    if (!candidate) {
      return null;
    }

    const result = await this.classifyFile(candidate, 'already-on-disk', match);
    if (result) {
      this.logger.info('Tidal file already on disk, adopting without re-download', {
        artist: match.queryArtist,
        title: match.queryTitle,
        filePath: candidate,
        format: result.format,
      });
    }
    return result;
  }

  /** Codec-probe a file and map it to an HqAudioAcquireResult. */
  private async classifyFile(
    filePath: string,
    resolvedVia: string,
    match: TidalMatch,
  ): Promise<HqAudioAcquireResult> {
    const probed = await probeAudioCodec(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let format: HqAudioAcquireResult['format'];
    if (probed?.codec === 'flac') {
      format = 'flac';
    } else if (probed && probed.codec.startsWith('pcm_')) {
      format = ext === '.aiff' || ext === '.aif' ? 'aiff' : 'wav';
    } else {
      format = ext === '.wav' ? 'wav' : ext === '.m4a' ? 'm4a' : 'flac';
    }
    this.logger.info('Tidal acquisition matched file', {
      artist: match.queryArtist,
      title: match.queryTitle,
      filePath,
      format,
      codec: probed?.codec ?? 'unknown',
      lossless: probed?.lossless ?? false,
      resolvedVia,
    });
    return { filePath, format };
  }

  /**
   * Downloads a previously found match. Serialised process-wide via
   * `downloadChain` so the output-directory diff is race-free.
   */
  async downloadMatch(
    match: TidalMatch,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    const run = this.downloadChain.then(() => this.downloadMatchInner(match, outputDir));
    // Keep the chain alive regardless of this download's outcome.
    this.downloadChain = run.catch(() => undefined);
    return run;
  }

  private async downloadMatchInner(
    match: TidalMatch,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    const resolvedOutputDir = outputDir || this.defaultOutputDir;
    const { queryArtist: artist, queryTitle: title } = match;

    // Adopt a matching file from a previous run instead of re-downloading.
    const existing = await this.findExistingDownload(match, resolvedOutputDir);
    if (existing) {
      return existing;
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

    // Downloads are serialised, so exactly one new file means it is ours.
    // Fall back to a text match only when nothing new appeared (tidal-dl-ng
    // skipped because the track was already downloaded in a prior run).
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

    return this.classifyFile(
      bestCandidate,
      newFiles.includes(bestCandidate) ? 'new-file-diff' : 'text-match-fallback',
      match,
    );
  }

  async acquire(
    artist: string,
    title: string,
    durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    const match = await this.findMatch(artist, title, durationSeconds);
    if (!match) {
      return null;
    }
    return this.downloadMatch(match, outputDir);
  }
}
