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

type NicotinePlusDownloadRow = [
  username: string,
  virtualPath: string,
  folderPath: string,
  status: string,
  size: number,
  currentByteOffset: number,
  fileAttributes: unknown,
];

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
  private readonly nicotinePlusDataDir: string;
  private readonly fastSearch: boolean;
  private readonly searchTimeoutMs: number;
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
    this.timeoutMs = this.configService.get<number>('hqAudio.sockseek.timeoutMs') ?? 240000;
    this.defaultOutputDir = this.configService.get<string>('hqAudio.sockseek.outputDir') ?? '';
    this.nicotinePlusDataDir =
      this.configService.get<string>('hqAudio.sockseek.nicotinePlusDataDir') ?? '';
    this.fastSearch = this.configService.get<boolean>('hqAudio.sockseek.fastSearch') ?? false;
    this.searchTimeoutMs =
      this.configService.get<number>('hqAudio.sockseek.searchTimeoutMs') ?? 30000;
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

  private async listIncompleteFiles(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir);
      return entries.filter((entry) => entry.endsWith('.incomplete'));
    } catch {
      return [];
    }
  }

  private async cleanupIncompleteFiles(
    dir: string,
    preExisting: Set<string>,
    artist: string,
    title: string,
  ): Promise<void> {
    const current = await this.listIncompleteFiles(dir);
    const newIncompleteFiles = current.filter((entry) => !preExisting.has(entry));
    for (const entry of newIncompleteFiles) {
      const fullPath = path.join(dir, entry);
      await fs
        .unlink(fullPath)
        .then(() => {
          this.logger.info('removed orphaned .incomplete file after failed acquisition', {
            artist,
            title,
            path: fullPath,
          });
        })
        .catch((error) => {
          this.logger.warn('failed to remove orphaned .incomplete file', {
            artist,
            title,
            path: fullPath,
            error: String(error),
          });
        });
    }
  }

  private get pendingQueuePath(): string {
    return path.join(this.nicotinePlusDataDir, 'sockseek-pending-downloads.json');
  }

  private get nicotinePlusDownloadsJsonPath(): string {
    return path.join(this.nicotinePlusDataDir, 'downloads.json');
  }

  private async isNicotinePlusRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const check = spawn('pgrep', ['-x', 'Nicotine+'], { stdio: ['ignore', 'ignore', 'ignore'] });
      check.on('error', () => resolve(false));
      check.on('close', (code) => resolve(code === 0));
    });
  }

  private async readJsonRows(filePath: string): Promise<NicotinePlusDownloadRow[]> {
    try {
      const existing = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(existing);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private buildNicotinePlusRow(
    username: string,
    filename: string,
    size: number,
  ): NicotinePlusDownloadRow {
    const virtualPath = filename.replace(/\\/g, '/');
    const folderPath = virtualPath.includes('/')
      ? virtualPath.slice(0, virtualPath.lastIndexOf('/'))
      : '';
    return [username, filename, folderPath, 'Paused', size, 0, null];
  }

  private async addPendingNicotinePlusDownload(
    username: string,
    filename: string,
    size: number,
    artist: string,
    title: string,
  ): Promise<void> {
    if (!this.nicotinePlusDataDir) {
      return;
    }
    try {
      const row = this.buildNicotinePlusRow(username, filename, size);
      const pending = await this.readJsonRows(this.pendingQueuePath);
      const alreadyPending = pending.some((r) => r[0] === row[0] && r[1] === row[1]);
      if (!alreadyPending) {
        pending.push(row);
        await fs.mkdir(this.nicotinePlusDataDir, { recursive: true });
        await fs.writeFile(this.pendingQueuePath, JSON.stringify(pending), 'utf-8');
      }
      this.logger.info('recorded incomplete sockseek download for Nicotine+ handoff', {
        artist,
        title,
        username,
        filename,
      });
      await this.flushPendingNicotinePlusDownloads();
    } catch (error) {
      this.logger.warn('failed to record incomplete sockseek download for Nicotine+ handoff', {
        artist,
        title,
        username,
        filename,
        error: String(error),
      });
    }
  }

  async flushPendingNicotinePlusDownloads(): Promise<void> {
    if (!this.nicotinePlusDataDir) {
      return;
    }
    try {
      const pending = await this.readJsonRows(this.pendingQueuePath);
      if (pending.length === 0) {
        return;
      }
      if (await this.isNicotinePlusRunning()) {
        this.logger.debug(
          'Nicotine+ is currently running, deferring pending download handoff until it is closed',
          { pendingCount: pending.length },
        );
        return;
      }

      const rows = await this.readJsonRows(this.nicotinePlusDownloadsJsonPath);
      let addedCount = 0;
      for (const row of pending) {
        const alreadyQueued = rows.some((r) => r[0] === row[0] && r[1] === row[1]);
        if (!alreadyQueued) {
          rows.push(row);
          addedCount++;
        }
      }

      await fs.writeFile(this.nicotinePlusDownloadsJsonPath, JSON.stringify(rows), 'utf-8');
      await fs.writeFile(this.pendingQueuePath, '[]', 'utf-8');
      this.logger.info('flushed pending sockseek downloads into Nicotine+', {
        addedCount,
        totalPending: pending.length,
      });
    } catch (error) {
      this.logger.warn('failed to flush pending sockseek downloads into Nicotine+', {
        error: String(error),
      });
    }
  }

  async acquire(
    artist: string,
    title: string,
    durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    const resolvedOutputDir = outputDir || this.defaultOutputDir;
    await fs.mkdir(resolvedOutputDir, { recursive: true });
    await this.flushPendingNicotinePlusDownloads();

    const preExistingIncompleteFiles = new Set(await this.listIncompleteFiles(resolvedOutputDir));

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
        '--search-timeout',
        this.searchTimeoutMs.toString(),
      );
      if (this.fastSearch) {
        args.push('--fast-search');
      }
      if (this.configPath) {
        args.push('--config', this.configPath);
      }

      const holder: {
        finalState: SockseekTrackStateEvent['data'] | null;
        downloadStart: SockseekDownloadStartEvent['data'] | null;
        timedOut: boolean;
      } = { finalState: null, downloadStart: null, timedOut: false };
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
          holder.timedOut = true;
          cmd.kill('SIGTERM');
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
            } else if (event.type === 'download_start') {
              holder.downloadStart = (event as SockseekDownloadStartEvent).data;
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
      const succeeded = finalState?.terminalOutcome === 'Succeeded' && !!finalState.downloadPath;

      if (!succeeded) {
        await this.cleanupIncompleteFiles(resolvedOutputDir, preExistingIncompleteFiles, artist, title);

        if (holder.downloadStart?.username && holder.downloadStart?.filename) {
          await this.addPendingNicotinePlusDownload(
            holder.downloadStart.username,
            holder.downloadStart.filename,
            holder.downloadStart.size ?? 0,
            artist,
            title,
          );
        }
      }

      if (!finalState) {
        this.logger.warn('sockseek produced no track_state event', {
          artist,
          title,
          stderr,
          timedOut: holder.timedOut,
        });
        return null;
      }

      if (!succeeded) {
        this.logger.warn('sockseek did not find a match', {
          artist,
          title,
          terminalOutcome: finalState.terminalOutcome,
          skipReason: finalState.skipReason,
          failureReason: finalState.failureReason,
          timedOut: holder.timedOut,
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
        filePath: finalState.downloadPath as string,
        format,
      };
    } finally {
      if (queryCsvPath) {
        await fs.unlink(queryCsvPath).catch(() => undefined);
      }
    }
  }
}
