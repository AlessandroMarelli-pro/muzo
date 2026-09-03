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
import {
  indexCsvPath,
  indexRowMatchKey,
  pruneStaleQueryDirs,
  readAllPriorIndexCsvDownloads,
  readIndexCsvDownloads,
  removeIndexCsvDir,
} from './sockseek-index-csv';

/** Delete leftover sockseek query scratch dirs older than this on each batch. */
const STALE_QUERY_DIR_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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

type HqAudioFormat = HqAudioAcquireResult['format'];

/**
 * `--pref-format` only ranks flac/wav/m4a/aiff/aif ahead of other formats, it does not exclude
 * them, so sockseek can still hand back an mp3 (or anything else). Only the formats we
 * actually asked for count as a successful HQ acquisition; anything else is treated as
 * "no acceptable match" rather than being mislabeled as flac.
 */
function resolveHqFormat(extension: string | undefined): HqAudioFormat | null {
  if (extension === 'flac' || extension === 'wav' || extension === 'm4a') {
    return extension;
  }
  // sockseek (and Soulseek uploaders) use both ".aif" and ".aiff" for the same format.
  if (extension === 'aiff' || extension === 'aif') {
    return 'aiff';
  }
  return null;
}

export interface SockseekBatchTrackQuery {
  key: string;
  artist: string;
  title: string;
  durationSeconds: number;
  /** Optional album hint: not added to the search query itself, but used to prefer
   *  matching results via `--pref-strict-album` when present. */
  album?: string;
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
  private readonly concurrentSearches: number;
  private readonly logger: ILogger;
  private readonly activeBatchProcesses = new Map<
    string,
    ChildProcessByStdio<null, Readable, Readable>
  >();
  // Batches cancelled via cancelBatch() while no process is currently running for them (e.g.
  // during the delay between retry passes) - checked before starting the next pass so a
  // cancellation isn't silently lost to timing.
  private readonly cancelledBatchIds = new Set<string>();

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
    this.concurrentSearches =
      this.configService.get<number>('hqAudio.sockseek.concurrentSearches') ?? 5;
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

  /**
   * Deterministic per-batch query-CSV path (not a random UUID) so sockseek's
   * `<outputDir>/<name>/_index.csv` is stable: a re-run of the same batch can
   * read and clear the previous index instead of accumulating scratch dirs.
   */
  private batchQueryCsvPath(batchId: string): string {
    const safeId = batchId.replace(/[^A-Za-z0-9._-]/g, '_');
    return path.join(os.tmpdir(), `sockseek-batch-${safeId}.csv`);
  }

  /**
   * Path to sockseek's `_index.csv` for a batch — its authoritative per-track
   * final record (see `sockseek-index-csv.ts`). Callers can poll this while the
   * batch runs to reconcile any settlement the stdout event stream dropped.
   */
  batchIndexCsvPath(batchId: string, outputDir: string): string {
    return indexCsvPath(this.batchQueryCsvPath(batchId), outputDir || this.defaultOutputDir);
  }

  private async writeBatchQueryCsv(
    batchId: string,
    tracks: SockseekBatchTrackQuery[],
  ): Promise<string> {
    const csvPath = this.batchQueryCsvPath(batchId);
    const rows = [
      'Artist,Title,Length,Album',
      ...tracks.map((track) =>
        [
          this.escapeCsvField(track.artist),
          this.escapeCsvField(track.title),
          Math.round(track.durationSeconds).toString(),
          this.escapeCsvField(track.album ?? ''),
        ].join(','),
      ),
    ];
    await fs.writeFile(csvPath, rows.join('\n'), 'utf-8');
    return csvPath;
  }

  /**
   * Writes a tiny Node helper script used as a sockseek `--on-complete` command. It appends
   * one `snum<TAB>downloadPath` line to `sidecarPath` for every successfully downloaded
   * track. `{snum}` is sockseek's 1-indexed source item number, which corresponds exactly to
   * the row order we wrote in the batch query CSV, so `snum - 1` indexes directly into our
   * `tracks` array - unlike artist/title, it survives sockseek's own normalization
   * (e.g. `--remove-ft`) untouched, so it is an exact key rather than a best-effort match.
   */
  private async writeOnCompleteHelper(): Promise<string> {
    const scriptPath = path.join(os.tmpdir(), `sockseek-on-complete-${crypto.randomUUID()}.js`);
    const script = [
      "const fs = require('fs');",
      'const [, , sidecarPath, snum, downloadPath] = process.argv;',
      'fs.appendFileSync(sidecarPath, `${snum}\\t${downloadPath}\\n`);',
      '',
    ].join('\n');
    await fs.writeFile(scriptPath, script, 'utf-8');
    return scriptPath;
  }

  private async readIndexCsv(
    queryCsvPath: string,
    outputDir: string,
  ): Promise<Map<number, string>> {
    try {
      return await readIndexCsvDownloads(queryCsvPath, outputDir);
    } catch (error) {
      this.logger.warn('failed to read sockseek _index.csv', { error: String(error) });
      return new Map();
    }
  }

  /**
   * Reads the sidecar file written by the on-complete helper and returns a map of
   * sockseek's 1-indexed `snum` to the downloaded file path, for every track that completed
   * successfully.
   */
  private async readOnCompleteSidecar(sidecarPath: string): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    try {
      const contents = await fs.readFile(sidecarPath, 'utf-8');
      for (const line of contents.split('\n')) {
        if (!line.trim()) {
          continue;
        }
        const [snumText, ...pathParts] = line.split('\t');
        const snum = Number.parseInt(snumText, 10);
        const downloadPath = pathParts.join('\t');
        if (Number.isInteger(snum) && downloadPath) {
          result.set(snum, downloadPath);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn('failed to read sockseek on-complete sidecar', { error: String(error) });
      }
    }
    return result;
  }

  /**
   * sockseek's reported `downloadPath` is otherwise trusted unvalidated; a stale or missing
   * path would only be caught much later (e.g. when the file is exported to a playlist
   * folder), which silently falls back to the original lossy file instead of surfacing the
   * problem here. Confirm the file actually exists before treating an acquisition as a
   * success.
   */
  private async downloadPathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
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

  /**
   * A single failed candidate (e.g. a peer's connection dropping mid-transfer) can end the
   * whole sockseek run even though the same search moments later would find another (or the
   * same) candidate and succeed - sockseek only retries a candidate that already failed up
   * to its own --max-retries, but gives up immediately once every discovered candidate has
   * been tried once, which is exactly what happens when only one candidate was found.
   * Retrying the entire acquisition (a fresh search, not just the download) works around
   * this at the cost of some latency on tracks that are genuinely unavailable.
   */
  private static readonly MAX_ACQUIRE_ATTEMPTS = 3;
  private static readonly ACQUIRE_RETRY_DELAY_MS = 5000;

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async acquire(
    artist: string,
    title: string,
    durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    for (let attempt = 1; attempt <= SockseekAcquirer.MAX_ACQUIRE_ATTEMPTS; attempt++) {
      const result = await this.acquireOnce(artist, title, durationSeconds, outputDir);
      if (result) {
        return result;
      }
      if (attempt < SockseekAcquirer.MAX_ACQUIRE_ATTEMPTS) {
        this.logger.info('sockseek acquisition failed, retrying', {
          artist,
          title,
          attempt,
          maxAttempts: SockseekAcquirer.MAX_ACQUIRE_ATTEMPTS,
        });
        await SockseekAcquirer.delay(SockseekAcquirer.ACQUIRE_RETRY_DELAY_MS);
      }
    }
    return null;
  }

  private async acquireOnce(
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
        'flac,wav,m4a,aiff,aif',
        '--pref-strict-title',
        '--pref-strict-artist',
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

        // `timeoutMs` is an inactivity window, not a hard cap on total
        // duration: it resets on every event (search progress, download
        // start, and crucially download_progress), so a large file that is
        // actively transferring keeps running past timeoutMs, and only a
        // genuinely stalled/hung process gets killed.
        let timer: ReturnType<typeof setTimeout>;
        const armTimer = () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            this.logger.warn('sockseek stalled (no activity), killing process', {
              artist,
              title,
              timeoutMs: this.timeoutMs,
            });
            holder.timedOut = true;
            cmd.kill('SIGTERM');
          }, this.timeoutMs);
        };
        armTimer();

        cmd.stdout.on('data', (chunk) => {
          stdoutBuffer += String(chunk);
          const lines = stdoutBuffer.split('\n');
          stdoutBuffer = lines.pop() ?? '';
          for (const line of lines) {
            const event = this.parseEventLine(line);
            if (!event) {
              continue;
            }
            armTimer();
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
            this.logger.debug(`sockseek : ${text}`, { artist, title });
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

      const format = resolveHqFormat(finalState.extension);
      if (!format) {
        this.logger.warn('sockseek matched a non-HQ format, discarding', {
          artist,
          title,
          downloadPath: finalState.downloadPath,
          extension: finalState.extension,
        });
        return null;
      }

      const downloadPath = finalState.downloadPath as string;
      if (!(await this.downloadPathExists(downloadPath))) {
        this.logger.warn('sockseek reported success but the download path does not exist', {
          artist,
          title,
          downloadPath,
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

      return {
        filePath: downloadPath,
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
  /**
   * Retries only the tracks that failed the previous pass, up to MAX_ACQUIRE_ATTEMPTS total
   * passes - the same single-candidate-connection-drop problem described above the
   * single-track retry wrapper applies here too. `onTrackSettled` is invoked at most once
   * per track across all passes: a track already settled successfully is skipped rather than
   * re-run, and only the final pass's outcome is reported for tracks still unresolved.
   */
  async acquireBatch(
    batchId: string,
    tracks: SockseekBatchTrackQuery[],
    outputDir: string,
    concurrentJobs: number,
    callbacks: SockseekBatchProgressCallbacks = {},
  ): Promise<void> {
    this.cancelledBatchIds.delete(batchId);
    const resolvedOutputDir = outputDir || this.defaultOutputDir;
    const queryCsvPath = this.batchQueryCsvPath(batchId);

    // Adopt anything a prior run already downloaded but never persisted so we
    // don't re-fetch it. Two sources, in order of key specificity:
    //  1. this same batchId's stable-named `_index.csv` (retry / reconnect) —
    //     exact row-index match.
    //  2. every OTHER `sockseek-batch-*/_index.csv` under the output dir (a
    //     fresh scan gets a new random batchId) — artist+title match.
    const alreadyDone = new Set<string>();
    const adopt = async (trackKey: string, filePath: string): Promise<boolean> => {
      const format = resolveHqFormat(path.extname(filePath).replace(/^\./, '').toLowerCase());
      if (!format || !(await this.downloadPathExists(filePath))) {
        return false;
      }
      this.logger.info('sockseek batch: adopting a prior download from _index.csv', {
        trackKey,
        downloadPath: filePath,
      });
      alreadyDone.add(trackKey);
      callbacks.onTrackSettled?.(trackKey, { status: 'succeeded', result: { filePath, format } });
      return true;
    };

    try {
      const prior = await readIndexCsvDownloads(queryCsvPath, resolvedOutputDir);
      for (const [index, filePath] of prior) {
        const track = tracks[index];
        if (track) {
          await adopt(track.key, filePath);
        }
      }
    } catch (error) {
      this.logger.warn('sockseek batch: failed to read prior _index.csv', {
        error: String(error),
      });
    }

    try {
      const priorByName = await readAllPriorIndexCsvDownloads(resolvedOutputDir);
      if (priorByName.size > 0) {
        for (const track of tracks) {
          if (alreadyDone.has(track.key)) {
            continue;
          }
          const filePath = priorByName.get(indexRowMatchKey(track.artist, track.title));
          if (filePath) {
            await adopt(track.key, filePath);
          }
        }
      }
    } catch (error) {
      this.logger.warn('sockseek batch: failed to scan prior batch _index.csv files', {
        error: String(error),
      });
    }
    void pruneStaleQueryDirs(resolvedOutputDir, STALE_QUERY_DIR_MAX_AGE_MS)
      .then((n) => {
        if (n > 0) {
          this.logger.info('sockseek: pruned stale query scratch dirs', { removed: n });
        }
      })
      .catch(() => undefined);

    let remainingTracks = tracks.filter((t) => !alreadyDone.has(t.key));
    try {
      for (let attempt = 1; attempt <= SockseekAcquirer.MAX_ACQUIRE_ATTEMPTS; attempt++) {
        if (remainingTracks.length === 0 || this.cancelledBatchIds.has(batchId)) {
          return;
        }

        const failedKeys = new Set<string>();
        const isLastAttempt = attempt === SockseekAcquirer.MAX_ACQUIRE_ATTEMPTS;
        await this.acquireBatchOnce(batchId, remainingTracks, outputDir, concurrentJobs, {
          onTrackSearchStart: callbacks.onTrackSearchStart,
          onTrackDownloadStart: callbacks.onTrackDownloadStart,
          onTrackSettled: (key, outcome) => {
            // Only 'not-found' is retried: 'succeeded' needs no retry, and 'interrupted'
            // means the batch was cancelled or timed out, which should not silently trigger
            // another pass.
            if (outcome.status !== 'not-found' || isLastAttempt) {
              callbacks.onTrackSettled?.(key, outcome);
              return;
            }
            // Leave it unreported for now - it'll either succeed on a later pass (reported
            // then) or fall through to the last attempt's report above.
            failedKeys.add(key);
          },
        });

        if (failedKeys.size === 0 || this.cancelledBatchIds.has(batchId)) {
          return;
        }

        remainingTracks = remainingTracks.filter((track) => failedKeys.has(track.key));
        if (!isLastAttempt) {
          this.logger.info('sockseek batch acquisition: some tracks failed, retrying', {
            batchId,
            failedCount: remainingTracks.length,
            attempt,
            maxAttempts: SockseekAcquirer.MAX_ACQUIRE_ATTEMPTS,
          });
          await SockseekAcquirer.delay(SockseekAcquirer.ACQUIRE_RETRY_DELAY_MS);
        }
      }
    } finally {
      this.cancelledBatchIds.delete(batchId);
      // Keep this batch's `_index.csv` dir: it is the adoption source for the
      // NEXT scan (which gets a fresh random batchId). Age-based pruning at the
      // top of each batch stops these from accumulating.
    }
  }

  private async acquireBatchOnce(
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
    const indexByKey = new Map<string, number>(tracks.map((track, index) => [track.key, index]));
    const pendingByIdentity = new Map<string, string[]>();
    // Provisional (name-matched) outcomes, keyed by track. For a track whose CSV
    // row is *unambiguous* (unique raw artist+title) the outcome is emitted to
    // `onTrackSettled` as soon as its `track_state` arrives, so a long batch
    // persists results incrementally instead of all at the end. Ambiguous rows
    // stay deferred: the {snum} sidecar (read at process exit) can still correct
    // which physical row a completion belongs to.
    const finalOutcomeByKey = new Map<string, SockseekBatchTrackOutcome>();
    const emittedKeys = new Set<string>();

    // `{snum}` is sockseek's own 1-indexed source item number and is exact for resolving
    // *sockseek-side* normalization (e.g. `--remove-ft` making two originally-different
    // inputs collide) - but when two CSV rows are byte-identical to begin with, sockseek
    // cannot tell which physical row a given completion belongs to and may report either
    // row's `snum` for either job. Only trust `snum` for rows whose raw (pre-normalization)
    // query is unique in this batch; for duplicate rows, keep the name-matched result, which
    // is at least self-consistent (a FIFO queue over the only jobs that share that identity).
    const rawRowCounts = new Map<string, number>();
    for (const track of tracks) {
      const rawIdentity = normalize(track.artist, track.title);
      rawRowCounts.set(rawIdentity, (rawRowCounts.get(rawIdentity) ?? 0) + 1);
    }
    const isUnambiguousRow = (index: number): boolean => {
      const track = tracks[index];
      return track ? rawRowCounts.get(normalize(track.artist, track.title)) === 1 : false;
    };

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

    const queryCsvPath = await this.writeBatchQueryCsv(batchId, tracks);
    const onCompleteScriptPath = await this.writeOnCompleteHelper();
    const onCompleteSidecarPath = path.join(
      os.tmpdir(),
      `sockseek-batch-snum-${crypto.randomUUID()}.tsv`,
    );

    // Start each pass from a clean `_index.csv` — the deterministic per-batch
    // path is reused across retry attempts, and stale rows would misalign with
    // this pass's (possibly smaller) track list.
    await removeIndexCsvDir(queryCsvPath, resolvedOutputDir).catch(() => undefined);

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
        '--album-col',
        'Album',
        '--length-tol',
        '9',
        '--progress-json',
        '-p',
        resolvedOutputDir,
        '--pref-format',
        'flac,wav,m4a,aiff,aif',
        '--pref-strict-title',
        '--pref-strict-artist',
        '--pref-strict-album',
        '--remove-ft',
        '--search-timeout',
        this.searchTimeoutMs.toString(),
        '--concurrent-jobs',
        concurrentJobs.toString(),
        '--concurrent-searches',
        this.concurrentSearches.toString(),
        '--on-complete',
        `when=success -- node "${onCompleteScriptPath}" "${onCompleteSidecarPath}" {snum} "{path}"`,
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
          if (!key || finalOutcomeByKey.has(key)) {
            return;
          }

          const queue = pendingByIdentity.get(normalize(data.artist ?? '', data.title ?? ''));
          queue?.shift();

          const format = resolveHqFormat(data.extension);
          const succeeded = data.terminalOutcome === 'Succeeded' && !!data.downloadPath && !!format;
          let outcome: SockseekBatchTrackOutcome;
          if (succeeded) {
            this.logger.info('sockseek batch track succeeded (provisional, name-matched)', {
              artist: data.artist,
              title: data.title,
              downloadPath: data.downloadPath,
            });
            outcome = {
              status: 'succeeded',
              result: { filePath: data.downloadPath as string, format: format as HqAudioFormat },
            };
          } else {
            if (data.terminalOutcome === 'Succeeded' && data.downloadPath && !format) {
              this.logger.warn('sockseek batch track matched a non-HQ format, discarding', {
                artist: data.artist,
                title: data.title,
                downloadPath: data.downloadPath,
                extension: data.extension,
              });
            } else {
              this.logger.warn('sockseek batch track did not find a match', {
                artist: data.artist,
                title: data.title,
                terminalOutcome: data.terminalOutcome,
                skipReason: data.skipReason,
                failureReason: data.failureReason,
              });
            }
            outcome = { status: 'not-found' };
          }
          finalOutcomeByKey.set(key, outcome);

          // Emit now for unambiguous rows; the sidecar can't change these.
          const idx = indexByKey.get(key);
          if (idx !== undefined && isUnambiguousRow(idx) && !emittedKeys.has(key)) {
            emittedKeys.add(key);
            callbacks.onTrackSettled?.(key, outcome);
          }
        }
      };

      await new Promise<void>((resolve, reject) => {
        const cmd = spawn(this.binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        this.activeBatchProcesses.set(batchId, cmd);

        // `batchTimeoutMs` is an inactivity window, not a hard cap on total
        // batch duration: it resets on every parsed event (including
        // download_progress), so a batch with large-but-actively-transferring
        // files keeps running past batchTimeoutMs, and only a genuinely
        // stalled/hung process gets killed.
        let timer: ReturnType<typeof setTimeout>;
        const armTimer = () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            this.logger.warn('sockseek batch stalled (no activity), killing process', {
              trackCount: tracks.length,
              timeoutMs: batchTimeoutMs,
            });
            timedOut = true;
            cmd.kill('SIGTERM');
          }, batchTimeoutMs);
        };
        armTimer();

        cmd.stdout.on('data', (chunk) => {
          const text = String(chunk);
          stdoutBuffer += text;
          const lines = stdoutBuffer.split('\n');
          stdoutBuffer = lines.pop() ?? '';
          for (const line of lines) {
            const event = this.parseEventLine(line);
            if (event) {
              armTimer();
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

      // Reconcile against the `{snum}` sidecar, which is exact: `snum` is sockseek's
      // 1-indexed source item number, corresponding directly to the row order of our own
      // query CSV, so `keyByIndex.get(snum - 1)` gives the correct key regardless of any
      // artist/title collisions or sockseek-side normalization. The sidecar only ever
      // records successes (it is driven by `--on-complete when=success`), so it can only
      // overwrite a `finalOutcomeByKey` entry with a success - it never turns a real success
      // into a failure, and any key it doesn't cover keeps whatever the name-matched
      // `track_state` handling already decided.
      const anyTrackSucceeded = [...finalOutcomeByKey.values()].some(
        (o) => o.status === 'succeeded',
      );
      const snumToPath = await this.readOnCompleteSidecar(onCompleteSidecarPath);
      if (snumToPath.size === 0 && anyTrackSucceeded) {
        // The sidecar produced nothing at all (e.g. `node` is unavailable on PATH) even
        // though sockseek reported at least one success - keep the name-matched results
        // rather than silently discarding every success in the batch, since with a single
        // success in the batch there is no collision to resolve anyway.
        this.logger.warn(
          'sockseek on-complete sidecar empty despite successful tracks, keeping name-matched results',
          { trackCount: tracks.length },
        );
      } else {
        for (const [snum, filePath] of snumToPath) {
          const index = snum - 1;
          const key = keyByIndex.get(index);
          if (!key) {
            continue;
          }
          if (isUnambiguousRow(index)) {
            // Already emitted eagerly from `track_state`; the sidecar can't
            // reassign it, so nothing to reconcile.
            continue;
          }
          // Ambiguous rows: `snum` is not reliable for byte-identical CSV rows,
          // so leave whatever the name-matched `track_state` handling decided.
          const format = resolveHqFormat(path.extname(filePath).replace(/^\./, '').toLowerCase());
          if (!format || !(await this.downloadPathExists(filePath))) {
            finalOutcomeByKey.set(key, { status: 'not-found' });
            continue;
          }
        }
      }

      // Authoritative reconciliation from sockseek's own `_index.csv` (rows in
      // our query-CSV order). Any track it records as downloaded that we did not
      // already settle as succeeded — e.g. its `track_state` line never reached
      // our stdout parser — is recovered here so the file isn't orphaned.
      const indexDownloads = await this.readIndexCsv(queryCsvPath, resolvedOutputDir);
      for (const [index, filePath] of indexDownloads) {
        const key = keyByIndex.get(index);
        if (!key) {
          continue;
        }
        const existing = finalOutcomeByKey.get(key);
        if (existing?.status === 'succeeded' || emittedKeys.has(key)) {
          continue;
        }
        const format = resolveHqFormat(path.extname(filePath).replace(/^\./, '').toLowerCase());
        if (!format || !(await this.downloadPathExists(filePath))) {
          continue;
        }
        this.logger.info('sockseek batch track recovered from _index.csv', {
          trackKey: key,
          downloadPath: filePath,
        });
        finalOutcomeByKey.set(key, { status: 'succeeded', result: { filePath, format } });
      }

      // Emit anything not already emitted (ambiguous rows + late corrections).
      for (const [key, outcome] of finalOutcomeByKey) {
        if (!emittedKeys.has(key)) {
          emittedKeys.add(key);
          callbacks.onTrackSettled?.(key, outcome);
        }
      }

      if (!cancelled) {
        for (const track of tracks) {
          if (!emittedKeys.has(track.key)) {
            emittedKeys.add(track.key);
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
      await fs.unlink(onCompleteScriptPath).catch(() => undefined);
      await fs.unlink(onCompleteSidecarPath).catch(() => undefined);
      // The `_index.csv` dir is left for the retry-pass wrapper to clear once,
      // after the final attempt — retry passes reuse the same (deterministic)
      // path.
    }
  }

  /**
   * Kills the sockseek process for a running batch, if one is active. Returns false if no
   * process is currently running for the given batchId (already finished or never started).
   */
  cancelBatch(batchId: string): boolean {
    this.cancelledBatchIds.add(batchId);
    const cmd = this.activeBatchProcesses.get(batchId);
    if (!cmd) {
      // No process currently running (e.g. between retry passes) - the retry loop checks
      // cancelledBatchIds before starting its next pass, so this cancellation still takes
      // effect, just not immediately.
      return false;
    }
    this.logger.info('cancelling sockseek batch', { batchId });
    cmd.kill('SIGTERM');
    return true;
  }
}
