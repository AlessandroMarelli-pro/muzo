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
import { HqAudioConfig, HqQualityTier } from 'src/config/hq-audio.config';
import { normalizeForMatch } from './match';

/**
 * Qobuz acquirer via streamrip (`rip`). `rip search --first qobuz track "<q>"`
 * searches and downloads the top match in one shot; we then diff the output
 * directory for the new lossless file, the same robust approach the Tidal
 * acquirer uses (independent of streamrip's console output format).
 *
 * Credentials live in the streamrip config file (QOBUZ_RIP_CONFIG_PATH), never
 * in this repo.
 */
@Injectable()
export class QobuzAcquirer implements IHqAudioAcquirer {
  private readonly cfg: HqAudioConfig['qobuz'];
  private readonly qualityTier: HqQualityTier;
  private readonly timeoutMs = 300_000;

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('QobuzAcquirer');
    const hqAudio = this.configService.get<HqAudioConfig>('hqAudio')!;
    this.cfg = hqAudio.qobuz;
    this.qualityTier = hqAudio.qualityTier;
  }

  /** Qobuz streamrip quality integers: 2 = 16/44.1, 3 = 24/<=96, 4 = 24/<=192. */
  private qualityFlag(): string {
    switch (this.qualityTier) {
      case 'hires':
        return '4';
      case 'any':
      case 'lossless':
      default:
        return '2';
    }
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
      this.logger.warn('Qobuz acquirer enabled but QOBUZ_RIP_CONFIG_PATH is unset; skipping');
      return null;
    }

    const resolvedOutputDir = outputDir || this.cfg.outputDir;
    await fs.mkdir(resolvedOutputDir, { recursive: true });

    const filesBefore = new Set(await this.listAudioFiles(resolvedOutputDir));
    const query = `${artist} ${title}`;

    this.logger.info('Qobuz acquisition starting', { artist, title, query });

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
      'qobuz',
      'track',
      query,
    ];

    try {
      await this.runRip(args);
    } catch (error) {
      this.logger.warn('Qobuz acquisition failed', { artist, title, error: String(error) });
      return null;
    }

    const filesAfter = await this.listAudioFiles(resolvedOutputDir);
    const newFiles = filesAfter.filter((f) => !filesBefore.has(f));

    if (newFiles.length === 0) {
      this.logger.warn('rip reported success but no new lossless file appeared', {
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

    this.logger.info('Qobuz acquisition matched file', { artist, title, filePath: best, format });
    return { filePath: best, format };
  }
}
