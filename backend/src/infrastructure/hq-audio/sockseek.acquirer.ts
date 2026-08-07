import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcessByStdio, spawn } from 'child_process';
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
import type { Readable } from 'stream';

type SockseekTrackStateEvent = {
  type: 'track_state';
  data: {
    artist?: string;
    title?: string;
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

type SockseekTrackListEvent = {
  type: 'track_list';
  data: {
    tracks: Array<{ index: number; artist?: string; title?: string }>;
  };
};

type SockseekEvent =
  | SockseekTrackStateEvent
  | SockseekSearchStartEvent
  | SockseekDownloadStartEvent
  | SockseekDownloadProgressEvent
  | SockseekTrackListEvent
  | { type: string; data: unknown };

export interface SockseekBatchTrackQuery {
  key: string;
  artist: string;
  title: string;
  durationSeconds: number;
}

export type SockseekBatchTrackOutcome =
  | { status: 'succeeded'; result: HqAudioAcquireResult }
  | { status: 'not-found' }
  | { status: 'interrupted' };

export interface SockseekBatchProgressCallbacks {
  onTrackSearchStart?: (key: string) => void;
  onTrackDownloadStart?: (key: string) => void;
  onTrackSettled?: (key: string, outcome: SockseekBatchTrackOutcome) => void;
}

@Injectable()
export class SockseekAcquirer implements IHqAudioAcquirer {
  private readonly binaryPath: string;
  private readonly configPath: string;
  private readonly timeoutMs: number;
  private readonly batchBaseTimeoutMs: number;
  private readonly batchPerTrackTimeoutMs: number;
  private readonly defaultOutputDir: string;
  private readonly nicotinePlusDataDir: string;
  private readonly fastSearch: boolean;
  private readonly searchTimeoutMs: number;
  private readonly logger: ILogger;
  private readonly activeBatchProcesses = new Map<
    string,
    ChildProcessByStdio<null, Readable, Readable>
  >();

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
    this.batchBaseTimeoutMs =
      this.configService.get<number>('hqAudio.sockseek.batchBaseTimeoutMs') ?? 120000;
    this.batchPerTrackTimeoutMs =
      this.configService.get<number>('hqAudio.sockseek.batchPerTrackTimeoutMs') ?? 30000;
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

  private async writeBatchQueryCsv(tracks: SockseekBatchTrackQuery[]): Promise<string> {
    const csvPath = path.join(os.tmpdir(), `sockseek-batch-query-${crypto.randomUUID()}.csv`);
    const rows = [
      'Artist,Title,Length',
      ...tracks.map((track) =>
        [
          this.escapeCsvField(track.artist),
          this.escapeCsvField(track.title),
          Math.round(track.durationSeconds).toString(),
        ].join(','),
      ),
    ];
    await fs.writeFile(csvPath, rows.join('\n'), 'utf-8');
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
        ? [queryCsvPath as string, '--input-type', 'csv', '--length-tol', '9', '--remove-ft']
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
        await this.cleanupIncompleteFiles(
          resolvedOutputDir,
          preExistingIncompleteFiles,
          artist,
          title,
        );

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

  /**
   * Acquires multiple tracks in a single sockseek process/login session, relying on
   * sockseek's own --concurrent-jobs for internal parallelism. Running one sockseek
   * process per track concurrently is not supported: each process independently tries to
   * log in to Soulseek and bind the listener port, so concurrent processes fight over the
   * same account session and port.
   */
  async acquireBatch(
    batchId: string,
    tracks: SockseekBatchTrackQuery[],
    outputDir: string,
    concurrentJobs: number,
    callbacks: SockseekBatchProgressCallbacks = {},
  ): Promise<void> {
    if (tracks.length === 0) {
      return;
    }

    const batchTimeoutMs = this.batchBaseTimeoutMs + this.batchPerTrackTimeoutMs * tracks.length;
    const resolvedOutputDir = outputDir || this.defaultOutputDir;
    await fs.mkdir(resolvedOutputDir, { recursive: true });
    await this.flushPendingNicotinePlusDownloads();

    const preExistingIncompleteFiles = new Set(await this.listIncompleteFiles(resolvedOutputDir));

    const normalize = (artist: string, title: string) =>
      `${artist.trim().toLowerCase()}|${title.trim().toLowerCase()}`;

    // sockseek may normalize artist/title before echoing them back in events (e.g. --remove-ft
    // strips "feat. X"), so matching events by re-deriving identity from our own pre-normalized
    // query strings is unreliable. Instead, wait for the one-time `track_list` event, which
    // reports sockseek's own normalized artist/title per CSV row index (rows are written in
    // `tracks` order), and build the identity map from *that* so all later events - which use
    // the same sockseek-side normalization - match correctly.
    const keyByIndex = new Map<number, string>(tracks.map((track, index) => [index, track.key]));
    const pendingByIdentity = new Map<string, string[]>();
    const settledKeys = new Set<string>();

    const registerTrackList = (event: SockseekTrackListEvent) => {
      for (const entry of event.data.tracks) {
        const key = keyByIndex.get(entry.index);
        if (!key || !entry.artist || !entry.title) {
          continue;
        }
        const identity = normalize(entry.artist, entry.title);
        const queue = pendingByIdentity.get(identity) ?? [];
        queue.push(key);
        pendingByIdentity.set(identity, queue);
      }
    };

    const resolveKey = (artist?: string, title?: string): string | null => {
      if (!artist || !title) {
        return null;
      }
      const queue = pendingByIdentity.get(normalize(artist, title));
      return queue && queue.length > 0 ? queue[0] : null;
    };

    const queryCsvPath = await this.writeBatchQueryCsv(tracks);

    this.logger.info('sockseek batch acquisition starting', {
      trackCount: tracks.length,
      outputDir: resolvedOutputDir,
      concurrentJobs,
      batchTimeoutMs,
    });

    try {
      const args = [
        queryCsvPath,
        '--input-type',
        'csv',
        '--length-tol',
        '9',
        '--progress-json',
        '-p',
        resolvedOutputDir,
        '--pref-format',
        'flac,wav',
        '--remove-ft',
        '--search-timeout',
        this.searchTimeoutMs.toString(),
        '--concurrent-jobs',
        concurrentJobs.toString(),
      ];
      if (this.fastSearch) {
        args.push('--fast-search');
      }
      if (this.configPath) {
        args.push('--config', this.configPath);
      }

      let stdoutBuffer = '';
      let stderr = '';
      let timedOut = false;
      let cancelled = false;

      const handleEvent = (event: SockseekEvent) => {
        if (event.type === 'track_list') {
          registerTrackList(event as SockseekTrackListEvent);
          return;
        }

        if (event.type === 'search_start') {
          const data = (event as SockseekSearchStartEvent).data;
          const key = resolveKey(data.artist, data.title);
          this.logEvent(event, data.artist ?? '', data.title ?? '');
          if (key) {
            callbacks.onTrackSearchStart?.(key);
          }
          return;
        }

        if (event.type === 'download_start') {
          const data = (event as SockseekDownloadStartEvent)
            .data as SockseekDownloadStartEvent['data'] & {
            artist?: string;
            title?: string;
          };
          const key = resolveKey(data.artist, data.title);
          this.logEvent(event, data.artist ?? '', data.title ?? '');
          if (key) {
            callbacks.onTrackDownloadStart?.(key);
          }
          return;
        }

        if (event.type === 'track_state') {
          const data = (event as SockseekTrackStateEvent).data;
          const key = resolveKey(data.artist, data.title);
          this.logEvent(event, data.artist ?? '', data.title ?? '');
          if (!key || settledKeys.has(key)) {
            return;
          }

          const queue = pendingByIdentity.get(normalize(data.artist ?? '', data.title ?? ''));
          queue?.shift();
          settledKeys.add(key);

          const succeeded = data.terminalOutcome === 'Succeeded' && !!data.downloadPath;
          if (succeeded) {
            this.logger.info('sockseek batch track succeeded', {
              artist: data.artist,
              title: data.title,
              downloadPath: data.downloadPath,
            });
            callbacks.onTrackSettled?.(key, {
              status: 'succeeded',
              result: {
                filePath: data.downloadPath as string,
                format: data.extension === 'wav' ? 'wav' : 'flac',
              },
            });
          } else {
            this.logger.warn('sockseek batch track did not find a match', {
              artist: data.artist,
              title: data.title,
              terminalOutcome: data.terminalOutcome,
              skipReason: data.skipReason,
              failureReason: data.failureReason,
            });
            callbacks.onTrackSettled?.(key, { status: 'not-found' });
          }
        }
      };

      await new Promise<void>((resolve, reject) => {
        const cmd = spawn(this.binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        this.activeBatchProcesses.set(batchId, cmd);

        const timer = setTimeout(() => {
          this.logger.warn('sockseek batch timed out, killing process', {
            trackCount: tracks.length,
            timeoutMs: batchTimeoutMs,
          });
          timedOut = true;
          cmd.kill('SIGTERM');
        }, batchTimeoutMs);

        cmd.stdout.on('data', (chunk) => {
          stdoutBuffer += String(chunk);
          const lines = stdoutBuffer.split('\n');
          stdoutBuffer = lines.pop() ?? '';
          for (const line of lines) {
            const event = this.parseEventLine(line);
            if (event) {
              handleEvent(event);
            }
          }
        });
        cmd.stderr.on('data', (chunk) => {
          const text = String(chunk).trim();
          stderr += text;
          if (text) {
            this.logger.debug('sockseek batch stderr', { line: text });
          }
        });
        cmd.on('error', (error) => {
          clearTimeout(timer);
          this.activeBatchProcesses.delete(batchId);
          this.logger.error('sockseek batch process failed to start', { error: String(error) });
          reject(error);
        });
        cmd.on('close', (code, signal) => {
          clearTimeout(timer);
          this.activeBatchProcesses.delete(batchId);
          cancelled = signal === 'SIGTERM' && !timedOut;
          const event = this.parseEventLine(stdoutBuffer);
          if (event) {
            handleEvent(event);
          }
          this.logger.debug('sockseek batch process exited', {
            exitCode: code,
            signal,
            stderr,
            timedOut,
            cancelled,
          });
          resolve();
        });
      });

      await this.cleanupIncompleteFiles(resolvedOutputDir, preExistingIncompleteFiles, '', '');

      if (!cancelled) {
        for (const track of tracks) {
          if (!settledKeys.has(track.key)) {
            if (timedOut) {
              this.logger.warn('sockseek batch track interrupted by batch timeout', {
                artist: track.artist,
                title: track.title,
              });
              callbacks.onTrackSettled?.(track.key, { status: 'interrupted' });
              continue;
            }
            this.logger.warn('sockseek batch track produced no track_state event', {
              artist: track.artist,
              title: track.title,
            });
            callbacks.onTrackSettled?.(track.key, { status: 'not-found' });
          }
        }
      }
    } finally {
      this.activeBatchProcesses.delete(batchId);
      await fs.unlink(queryCsvPath).catch(() => undefined);
    }
  }

  /**
   * Kills the sockseek process for a running batch, if one is active. Returns false if no
   * process is currently running for the given batchId (already finished or never started).
   */
  cancelBatch(batchId: string): boolean {
    const cmd = this.activeBatchProcesses.get(batchId);
    if (!cmd) {
      return false;
    }
    this.logger.info('cancelling sockseek batch', { batchId });
    cmd.kill('SIGTERM');
    return true;
  }
}
