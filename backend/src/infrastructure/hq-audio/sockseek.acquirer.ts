import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  HqAudioAcquireResult,
  IHqAudioAcquirer,
} from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';

type SockseekTrackStateEvent = {
  type: 'track_state';
  data: {
    terminalOutcome?: string;
    skipReason?: string;
    failureReason?: string;
    downloadPath?: string;
    extension?: string;
    resultCount?: number;
    lockedCount?: number;
  };
};

type SockseekSearchStartEvent = {
  type: 'search_start';
  data: { artist?: string; title?: string };
};

type SockseekDownloadStartEvent = {
  type: 'download_start';
  data: { username?: string; filename?: string; size?: number; extension?: string };
};

type SockseekDownloadProgressEvent = {
  type: 'download_progress';
  data: { bytesTransferred?: number; totalBytes?: number; percent?: number };
};

type SockseekEvent =
  | SockseekTrackStateEvent
  | SockseekSearchStartEvent
  | SockseekDownloadStartEvent
  | SockseekDownloadProgressEvent
  | { type: string; data: unknown };

@Injectable()
export class SockseekAcquirer implements IHqAudioAcquirer {
  private readonly binaryPath: string;
  private readonly configPath: string;
  private readonly timeoutMs: number;
  private readonly defaultOutputDir: string;
  private readonly logger: ILogger;

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('SockseekAcquirer');
    this.binaryPath = this.configService.get<string>('hqAudio.sockseek.binaryPath') ?? 'sockseek';
    this.configPath = this.configService.get<string>('hqAudio.sockseek.configPath') ?? '';
    this.timeoutMs = this.configService.get<number>('hqAudio.sockseek.timeoutMs') ?? 360000;
    this.defaultOutputDir = this.configService.get<string>('hqAudio.sockseek.outputDir') ?? '';
  }

  private parseEventLine(line: string): SockseekEvent | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed?.type === 'string') {
        return parsed as SockseekEvent;
      }
      return null;
    } catch {
      return null;
    }
  }

  private logEvent(event: SockseekEvent, artist: string, title: string): void {
    switch (event.type) {
      case 'search_start':
        this.logger.info('sockseek search started', { artist, title });
        break;
      case 'download_start': {
        const data = event.data as SockseekDownloadStartEvent['data'];
        this.logger.info('sockseek found a candidate, starting download', {
          artist,
          title,
          username: data.username,
          filename: data.filename,
          size: data.size,
          extension: data.extension,
        });
        break;
      }
      case 'download_progress': {
        const data = event.data as SockseekDownloadProgressEvent['data'];
        this.logger.debug('sockseek download progress', {
          artist,
          title,
          percent: data.percent,
          bytesTransferred: data.bytesTransferred,
          totalBytes: data.totalBytes,
        });
        break;
      }
      default:
        break;
    }
  }

  private escapeCsvField(value: string): string {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private async writeQueryCsv(
    artist: string,
    title: string,
    durationSeconds: number,
  ): Promise<string> {
    const csvPath = path.join(os.tmpdir(), `sockseek-query-${crypto.randomUUID()}.csv`);
    const csv = [
      'Artist,Title,Length',
      [
        this.escapeCsvField(artist),
        this.escapeCsvField(title),
        Math.round(durationSeconds).toString(),
      ].join(','),
    ].join('\n');
    await fs.writeFile(csvPath, csv, 'utf-8');
    return csvPath;
  }

  async acquire(
    artist: string,
    title: string,
    durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    const resolvedOutputDir = outputDir || this.defaultOutputDir;
    await fs.mkdir(resolvedOutputDir, { recursive: true });

    const hasKnownDuration = durationSeconds > 0;
    const queryCsvPath = hasKnownDuration
      ? await this.writeQueryCsv(artist, title, durationSeconds)
      : null;

    this.logger.info('sockseek acquisition starting', {
      artist,
      title,
      durationSeconds: hasKnownDuration ? Math.round(durationSeconds) : null,
      outputDir: resolvedOutputDir,
    });

    try {
      const args = hasKnownDuration
        ? [queryCsvPath as string, '--input-type', 'csv', '--length-tol', '9']
        : [`${artist} - ${title}`, '-s'];
      args.push(
        '--progress-json',
        '-p',
        resolvedOutputDir,
        '--pref-format',
        'flac,wav',
        '--fast-search',
      );
      if (this.configPath) {
        args.push('--config', this.configPath);
      }

      const holder: { finalState: SockseekTrackStateEvent['data'] | null } = { finalState: null };
      let stdoutBuffer = '';
      let stderr = '';

      await new Promise<void>((resolve, reject) => {
        const cmd = spawn(this.binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        const timer = setTimeout(() => {
          this.logger.warn('sockseek timed out, killing process', {
            artist,
            title,
            timeoutMs: this.timeoutMs,
          });
          cmd.kill('SIGTERM');
          reject(new Error(`sockseek timed out after ${this.timeoutMs}ms`));
        }, this.timeoutMs);

        cmd.stdout.on('data', (chunk) => {
          stdoutBuffer += String(chunk);
          const lines = stdoutBuffer.split('\n');
          stdoutBuffer = lines.pop() ?? '';
          for (const line of lines) {
            const event = this.parseEventLine(line);
            if (!event) {
              continue;
            }
            this.logEvent(event, artist, title);
            if (event.type === 'track_state') {
              holder.finalState = (event as SockseekTrackStateEvent).data;
            }
          }
        });
        cmd.stderr.on('data', (chunk) => {
          const text = String(chunk).trim();
          stderr += text;
          if (text) {
            this.logger.debug('sockseek stderr', { artist, title, line: text });
          }
        });
        cmd.on('error', (error) => {
          clearTimeout(timer);
          this.logger.error('sockseek process failed to start', {
            artist,
            title,
            error: String(error),
          });
          reject(error);
        });
        cmd.on('close', (code) => {
          clearTimeout(timer);
          const event = this.parseEventLine(stdoutBuffer);
          if (event) {
            this.logEvent(event, artist, title);
            if (event.type === 'track_state') {
              holder.finalState = (event as SockseekTrackStateEvent).data;
            }
          }
          this.logger.debug('sockseek process exited', { artist, title, exitCode: code });
          resolve();
        });
      });

      const finalState = holder.finalState;
      if (!finalState) {
        this.logger.warn('sockseek produced no track_state event', { artist, title, stderr });
        return null;
      }

      if (finalState.terminalOutcome !== 'Succeeded' || !finalState.downloadPath) {
        this.logger.warn('sockseek did not find a match', {
          artist,
          title,
          terminalOutcome: finalState.terminalOutcome,
          skipReason: finalState.skipReason,
          failureReason: finalState.failureReason,
        });
        return null;
      }

      this.logger.info('sockseek acquisition succeeded', {
        artist,
        title,
        downloadPath: finalState.downloadPath,
        extension: finalState.extension,
        resultCount: finalState.resultCount,
        lockedCount: finalState.lockedCount,
      });

      const format = finalState.extension === 'wav' ? 'wav' : 'flac';
      return {
        filePath: finalState.downloadPath,
        format,
      };
    } finally {
      if (queryCsvPath) {
        await fs.unlink(queryCsvPath).catch(() => undefined);
      }
    }
  }
}
