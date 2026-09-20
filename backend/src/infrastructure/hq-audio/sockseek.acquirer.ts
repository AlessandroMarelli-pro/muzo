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
  batchDir,
  indexCsvPath,
  inputCsvPath,
  pruneStaleQueryDirs,
  readAllPriorIndexCsvDownloads,
  readIndexCsvDownloads,
  trackIdFromPath,
  trackIdToFileToken,
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

  /**
   * Path to sockseek's `_index.csv` for a batch — its authoritative per-track
   * final record (see `sockseek-index-csv.ts`). Callers can poll this while the
   * batch runs to reconcile any settlement the stdout event stream dropped.
   */
  batchIndexCsvPath(batchId: string, outputDir: string): string {
    return indexCsvPath(batchId, outputDir || this.defaultOutputDir);
  }

  /**
   * Writes the batch manifest into the batch's own directory, so a run is fully
   * self-describing on disk (`_input.csv` next to sockseek's `_index.csv` and
   * the downloads).
   *
   * The id column MUST stay named `Id`: sockseek maps that header onto its
   * `{uri}` name-format variable, which is what writes the `MusicTrackId` into
   * every downloaded filename. Renaming it to `TrackId` makes sockseek ignore
   * the column, `{uri}` render empty, and every file in the batch collide onto
   * one name — silently.
   */
  private async writeBatchInputCsv(
    batchId: string,
    tracks: SockseekBatchTrackQuery[],
    outputDir: string,
  ): Promise<string> {
    const csvPath = inputCsvPath(batchId, outputDir);
    const rows = [
      'Artist,Title,Length,Album,Id',
      ...tracks.map((track) =>
        [
          this.escapeCsvField(track.artist),
          this.escapeCsvField(track.title),
          Math.round(track.durationSeconds).toString(),
          this.escapeCsvField(track.album ?? ''),
          // Stripped of the `MusicTrack:` prefix — a `:` is not filename-safe,
          // and this value lands verbatim in every downloaded filename.
          this.escapeCsvField(trackIdToFileToken(track.key)),
        ].join(','),
      ),
    ];
    await fs.mkdir(path.dirname(csvPath), { recursive: true });
    await fs.writeFile(csvPath, rows.join('\n'), 'utf-8');
    return csvPath;
  }

  private async readIndexCsv(
    batchId: string,
    outputDir: string,
  ): Promise<Map<string, string>> {
    try {
      return await readIndexCsvDownloads(batchId, outputDir);
    } catch (error) {
      this.logger.warn('failed to read sockseek _index.csv', { error: String(error) });
      return new Map();
    }
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
    // One code path: a single track is just a one-row batch. This keeps the
    // arg builder, retry policy, identity handling and result plumbing
    // identical for both entry points, and gives the single-track path the
    // album hint and concurrency flags it previously lacked.
    const batchId = `single-${crypto.randomUUID()}`;
    // Synthetic per-run id: the acquirer interface has no MusicTrackId, but the
    // filename still needs a unique key to carry identity through sockseek.
    const key = crypto.randomUUID();

    let acquired: HqAudioAcquireResult | null = null;
    await this.acquireBatch(
      batchId,
      [{ key, artist, title, durationSeconds }],
      outputDir,
      1,
      {
        onTrackSettled: (_key, outcome) => {
          if (outcome.status === 'succeeded') {
            acquired = outcome.result;
          }
        },
      },
    );
    return acquired;
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

    // Adopt anything a prior run already downloaded but never persisted so we
    // don't re-fetch it. A single scan over every `sockseek-batch-*/_index.csv`
    // covers both the retry/reconnect case (this batch's own dir) and a fresh
    // scan that got a new random batchId — all keyed by the `MusicTrackId`
    // embedded in each filename, so an adoption can never land on the wrong
    // track the way the old artist+title matching could.
    const alreadyDone = new Set<string>();
    const wantedKeys = new Set(tracks.map((track) => track.key));
    try {
      const prior = await readAllPriorIndexCsvDownloads(resolvedOutputDir);
      for (const [trackId, filePath] of prior) {
        if (!wantedKeys.has(trackId) || alreadyDone.has(trackId)) {
          continue;
        }
        const format = resolveHqFormat(path.extname(filePath).replace(/^\./, '').toLowerCase());
        if (!format || !(await this.downloadPathExists(filePath))) {
          continue;
        }
        this.logger.info('sockseek batch: adopting a prior download from _index.csv', {
          trackKey: trackId,
          downloadPath: filePath,
        });
        alreadyDone.add(trackId);
        callbacks.onTrackSettled?.(trackId, { status: 'succeeded', result: { filePath, format } });
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
    const batchOutputDir = batchDir(batchId, resolvedOutputDir);
    await fs.mkdir(batchOutputDir, { recursive: true });
    await this.flushPendingNicotinePlusDownloads();

    // Scoped to this batch's own dir, which is where downloads land — so the
    // post-run cleanup can only ever remove `.incomplete` files this pass
    // created, never a stray one elsewhere in the library.
    const preExistingIncompleteFiles = new Set(await this.listIncompleteFiles(batchOutputDir));

    // Identity comes from the `MusicTrackId` sockseek writes into each filename
    // via `--name-format '{uri}__…'`, so there is no name matching, no FIFO
    // queue over ambiguous rows, and no row-position bookkeeping. A track's
    // outcome is resolved by reading its own id back off the path it produced.
    const knownKeys = new Set(tracks.map((track) => track.key));
    const finalOutcomeByKey = new Map<string, SockseekBatchTrackOutcome>();
    const emittedKeys = new Set<string>();

    const settle = (key: string, outcome: SockseekBatchTrackOutcome) => {
      if (finalOutcomeByKey.has(key) || !knownKeys.has(key)) {
        return;
      }
      finalOutcomeByKey.set(key, outcome);
      emittedKeys.add(key);
      callbacks.onTrackSettled?.(key, outcome);
    };

    const inputCsv = await this.writeBatchInputCsv(batchId, tracks, resolvedOutputDir);

    this.logger.info('sockseek batch acquisition starting', {
      trackCount: tracks.length,
      outputDir: batchOutputDir,
      concurrentJobs,
      batchTimeoutMs,
    });

    try {
      const args = [
        inputCsv,
        '--input-type',
        'csv',
        '--album-col',
        'Album',
        // Writes the MusicTrackId (the `Id` column, which sockseek exposes as
        // `{uri}`) into every downloaded filename. This is the batch's entire
        // identity mechanism — see `trackIdFromPath`.
        '--name-format',
        '{uri}__{sartist} - {stitle}',
        '--index-path',
        indexCsvPath(batchId, resolvedOutputDir),
        '--length-tol',
        '7',
        '--strict-conditions',
        '--progress-json',
        '-p',
        batchOutputDir,
        // `--format` rejects non-HQ candidates during ranking. `--pref-format`
        // alone only *ranks* them, so sockseek would download an mp3 and
        // `resolveHqFormat` would discard it afterwards — paying for the
        // transfer to learn it was unusable.
        '--format',
        'flac,wav,m4a,aiff,aif',
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
      ];
      if (this.fastSearch) {
        args.push('--fast-search');
      }
      // Without this, `~/.config/sockseek/sockseek.conf` silently applies to
      // every run, so behaviour depends on a file outside the repo. Only an
      // explicitly configured path is honoured.
      args.push(...(this.configPath ? ['--config', this.configPath] : ['--no-config']));
      let stdoutBuffer = '';
      let stderr = '';
      let timedOut = false;
      let cancelled = false;

      // Progress-only, best-effort name match. `search_start`/`download_start`
      // carry no path, so there is no id to key on — but these events drive the
      // spinner, never persistence, so a mismatch on duplicate titles is
      // cosmetic. Anything that writes to the DB goes through the id instead.
      const progressKeyByName = new Map<string, string>();
      for (const track of tracks) {
        const name = `${track.artist.trim().toLowerCase()}|${track.title.trim().toLowerCase()}`;
        if (!progressKeyByName.has(name)) {
          progressKeyByName.set(name, track.key);
        }
      }
      const progressKey = (artist?: string, title?: string): string | undefined =>
        artist && title
          ? progressKeyByName.get(`${artist.trim().toLowerCase()}|${title.trim().toLowerCase()}`)
          : undefined;

      const handleEvent = (event: SockseekEvent) => {
        if (event.type === 'track_list') {
          return;
        }

        if (event.type === 'search_start') {
          const data = (event as SockseekSearchStartEvent).data;
          this.logEvent(event, data.artist ?? '', data.title ?? '');
          const key = progressKey(data.artist, data.title);
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
          this.logEvent(event, data.artist ?? '', data.title ?? '');
          const key = progressKey(data.artist, data.title);
          if (key) {
            callbacks.onTrackDownloadStart?.(key);
          }
          return;
        }

        if (event.type === 'track_state') {
          const data = (event as SockseekTrackStateEvent).data;
          this.logEvent(event, data.artist ?? '', data.title ?? '');

          // A success names its own track: the id is in the path sockseek just
          // wrote. A failure has no path, so it can only be attributed by name
          // — and misattributing a *failure* costs at most a redundant retry on
          // the next provider, never a wrong file in the DB.
          if (data.terminalOutcome === 'Succeeded' && data.downloadPath) {
            const key = trackIdFromPath(data.downloadPath);
            if (!key) {
              this.logger.warn('sockseek batch: downloaded file carries no track id, ignoring', {
                downloadPath: data.downloadPath,
              });
              return;
            }
            const format = resolveHqFormat(data.extension);
            if (!format) {
              this.logger.warn('sockseek batch track matched a non-HQ format, discarding', {
                trackKey: key,
                downloadPath: data.downloadPath,
                extension: data.extension,
              });
              settle(key, { status: 'not-found' });
              return;
            }
            this.logger.info('sockseek batch track succeeded', {
              trackKey: key,
              downloadPath: data.downloadPath,
            });
            settle(key, {
              status: 'succeeded',
              result: { filePath: data.downloadPath, format },
            });
            return;
          }

          const key = progressKey(data.artist, data.title);
          this.logger.warn('sockseek batch track did not find a match', {
            artist: data.artist,
            title: data.title,
            terminalOutcome: data.terminalOutcome,
            skipReason: data.skipReason,
            failureReason: data.failureReason,
          });
          if (key) {
            settle(key, { status: 'not-found' });
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

      await this.cleanupIncompleteFiles(batchOutputDir, preExistingIncompleteFiles, '', '');

      // Recover anything sockseek recorded as downloaded whose `track_state`
      // line never reached our stdout parser, so the file isn't orphaned. Keyed
      // by the id in the filename, so a collapsed/reordered index row can't
      // attribute a file to the wrong track.
      const indexDownloads = await this.readIndexCsv(batchId, resolvedOutputDir);
      for (const [key, filePath] of indexDownloads) {
        if (finalOutcomeByKey.get(key)?.status === 'succeeded' || !knownKeys.has(key)) {
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
        // Overrides an earlier name-matched 'not-found': the index is
        // authoritative, and the id proves which track the file belongs to.
        finalOutcomeByKey.delete(key);
        emittedKeys.delete(key);
        settle(key, { status: 'succeeded', result: { filePath, format } });
      }

      if (!cancelled) {
        for (const track of tracks) {
          if (emittedKeys.has(track.key)) {
            continue;
          }
          if (timedOut) {
            this.logger.warn('sockseek batch track interrupted by batch timeout', {
              artist: track.artist,
              title: track.title,
            });
            settle(track.key, { status: 'interrupted' });
            continue;
          }
          this.logger.warn('sockseek batch track produced no track_state event', {
            artist: track.artist,
            title: track.title,
          });
          settle(track.key, { status: 'not-found' });
        }
      }
    } finally {
      this.activeBatchProcesses.delete(batchId);
      // The batch dir (holding `_input.csv`, `_index.csv` and the downloads) is
      // kept: retry passes reuse it, and it is the adoption source for a later
      // run that never persisted its files. Age-pruned at the top of each batch.
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
