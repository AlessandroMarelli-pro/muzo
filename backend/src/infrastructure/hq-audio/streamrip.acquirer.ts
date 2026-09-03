import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  HqAudioAcquireResult,
  IHqAudioAcquirer,
} from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { HqQualityTier } from 'src/config/hq-audio.config';
import { normalizeForMatch } from './match';

export interface StreamripSourceConfig {
  enabled: boolean;
  ripConfigPath: string;
  ripBinaryPath: string;
  outputDir: string;
}

/**
 * Shared implementation for streamrip-backed sources (Qobuz, Deezer). Runs
 * `rip search --first <source> track "<q>"` to search+download in one shot,
 * then diffs the output directory for the new lossless file (robust to
 * streamrip's console output format). Credentials live only in the rip config
 * file, never in this repo.
 */
export abstract class StreamripAcquirer implements IHqAudioAcquirer {
  protected abstract readonly source: 'qobuz' | 'deezer';
  private readonly timeoutMs = 300_000;

  protected constructor(
    protected readonly cfg: StreamripSourceConfig,
    protected readonly qualityTier: HqQualityTier,
    protected readonly logger: ILogger,
  ) {}

  /** Per-source quality flag. Deezer is 16/44.1 only; Qobuz supports hi-res. */
  protected abstract qualityFlag(): string;

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
        return ext === '.flac' || ext === '.wav' ? [entryPath] : [];
      }),
    );
    return nested.flat();
  }

  private runRip(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = spawn(this.cfg.ripBinaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      const timer = setTimeout(() => {
        cmd.kill('SIGTERM');
        reject(new Error(`rip timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      cmd.stderr.on('data', (c) => {
        stderr += String(c);
      });
      cmd.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      cmd.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`rip exited ${code}: ${stderr.split('\n').slice(-10).join('\n')}`));
        }
      });
    });
  }

  async acquire(
    artist: string,
    title: string,
    _durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    if (!this.cfg.enabled) {
      return null;
    }
    if (!this.cfg.ripConfigPath) {
      this.logger.warn(
        `${this.source} acquirer enabled but its rip config path is unset; skipping`,
      );
      return null;
    }

    const resolvedOutputDir = outputDir || this.cfg.outputDir;
    await fs.mkdir(resolvedOutputDir, { recursive: true });

    const filesBefore = new Set(await this.listAudioFiles(resolvedOutputDir));
    const query = `${artist} ${title}`;

    this.logger.info(`${this.source} acquisition starting`, { artist, title, query });

    const args = [
      '--config-path',
      this.cfg.ripConfigPath,
      '--folder',
      resolvedOutputDir,
      '--quality',
      this.qualityFlag(),
      '--no-progress',
      'search',
      '--first',
      this.source,
      'track',
      query,
    ];

    try {
      await this.runRip(args);
    } catch (error) {
      this.logger.warn(`${this.source} acquisition failed`, {
        artist,
        title,
        error: String(error),
      });
      return null;
    }

    const newFiles = (await this.listAudioFiles(resolvedOutputDir)).filter(
      (f) => !filesBefore.has(f),
    );
    if (newFiles.length === 0) {
      this.logger.warn('rip reported success but no new lossless file appeared', {
        source: this.source,
        artist,
        title,
        outputDir: resolvedOutputDir,
      });
      return null;
    }

    const normArtist = normalizeForMatch(artist);
    const normTitle = normalizeForMatch(title);
    const matches = (f: string) => {
      const n = normalizeForMatch(f);
      return n.includes(normArtist) && n.includes(normTitle);
    };
    const best =
      newFiles.length === 1 ? newFiles[0] : (newFiles.find(matches) ?? newFiles[0]);
    const format = path.extname(best).toLowerCase() === '.wav' ? 'wav' : 'flac';

    this.logger.info(`${this.source} acquisition matched file`, {
      artist,
      title,
      filePath: best,
      format,
    });
    return { filePath: best, format };
  }
}
