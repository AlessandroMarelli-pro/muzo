import {
  HqAudioBatchState,
  HqAudioTrackStatus,
} from 'src/application/ports/dtos/HqAudioBatchProgress.types';
import { IHqAudioBatchProgressPublisher } from 'src/application/ports/infrastructure/IHqAudioBatchProgressPublisher';
import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { ConfigService } from '@nestjs/config';
import { IHqAudioTagger } from 'src/application/ports/infrastructure/IHqAudioTagger';
import { IHqAudioVerifier } from 'src/application/ports/infrastructure/IHqAudioVerifier';
import { IMusicTrackRepository } from 'src/application/ports/repositories/IMusicTrackRepository';
import * as fs from 'fs/promises';
import * as path from 'path';
import { readIndexCsvRowsAt } from 'src/infrastructure/hq-audio/sockseek-index-csv';
import {
  SockseekAcquirer,
  SockseekBatchTrackQuery,
} from 'src/infrastructure/hq-audio/sockseek.acquirer';
import { TidalDlAcquirer } from 'src/infrastructure/hq-audio/tidal-dl.acquirer';
import { HqAudioBatchId, MusicTrackId } from 'src/kernel/ids';
import type { HqAudioAcquireResult } from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import type { MusicTrack } from 'src/kernel/types/model-types';
import { mapWithConcurrency } from 'src/kernel/utils/concurrency';

const CONCURRENT_JOBS = 5;
/** Tidal fallback runs after Soulseek: search in parallel, downloads serialised. */
const TIDAL_SEARCH_CONCURRENCY = 3;
/** Hard cap on a single Tidal search+download so one hung request can't stall the batch. */
const TIDAL_FALLBACK_TIMEOUT_MS = 45_000;
/** How often to reconcile against sockseek's `_index.csv` while a batch runs. */
const INDEX_CSV_POLL_MS = 3_000;
/** Concurrent spectral-verify uploads to ai-service in the slow tail. */
const VERIFY_CONCURRENCY = 3;

interface PendingVerification {
  trackId: MusicTrackId;
  filePath: string;
  format: HqAudioAcquireResult['format'];
  track: MusicTrack | undefined;
}

function extToFormat(filePath: string): HqAudioAcquireResult['format'] | null {
  switch (path.extname(filePath).toLowerCase()) {
    case '.flac':
      return 'flac';
    case '.wav':
      return 'wav';
    case '.aiff':
    case '.aif':
      return 'aiff';
    case '.m4a':
      return 'm4a';
    default:
      return null;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

interface BatchTrackQuery {
  key: MusicTrackId;
  artist: string;
  title: string;
  durationSeconds: number;
  album?: string;
}

export class AcquireHqAudioBatchUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly tidalDlAcquirer: TidalDlAcquirer,
    private readonly sockseekAcquirer: SockseekAcquirer,
    private readonly hqAudioBatchProgressPublisher: IHqAudioBatchProgressPublisher,
    private readonly hqAudioVerifier: IHqAudioVerifier,
    private readonly hqAudioTagger: IHqAudioTagger,
    private readonly configService: ConfigService,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('AcquireHqAudioBatchUseCase');
  }

  private get verifyLossless(): boolean {
    return this.configService.get<boolean>('hqAudio.verifyLossless') !== false;
  }

  async execute(batchId: HqAudioBatchId, trackIds: MusicTrackId[]): Promise<void> {
    const tracks = await this.musicTrackRepository.getManyByIds(trackIds);
    const trackById = new Map(tracks.map((track) => [track.id, track]));

    const queries: BatchTrackQuery[] = trackIds.flatMap((trackId): BatchTrackQuery[] => {
      const track = trackById.get(trackId);
      if (!track?.artist || !track?.title) {
        return [];
      }
      return [
        {
          key: trackId,
          artist: track.artist,
          title: track.title,
          durationSeconds: track.technicalInfo?.duration ?? 0,
          album: track.metadata?.album,
        },
      ];
    });

    for (const trackId of trackIds) {
      if (!queries.some((query) => query.key === trackId)) {
        await this.updateTrackStatus(batchId, trackId, 'failed', 'Missing artist/title metadata');
      }
    }

    if (queries.length === 0) {
      return;
    }

    // Tracks whose fast persist (hqAudioPath + 'succeeded') has landed and now
    // only need the slow tail: spectral verify + tag. Drained after Soulseek.
    const pendingVerification: PendingVerification[] = [];
    // Tracks already persisted this run — keeps the poller and the settle
    // callback from double-persisting the same track.
    const persisted = new Set<MusicTrackId>();
    // Fire-and-forget fast-persist promises (from settle callbacks and the
    // poller). Awaited before the verify tail so `pendingVerification` is fully
    // populated.
    const persistTasks: Promise<void>[] = [];
    const trackPersist = (p: Promise<void>) => {
      persistTasks.push(p);
    };

    // Soulseek first — it is the only source that reliably yields lossless
    // (Tidal's downloader is capped at 320k AAC, Qobuz isn't wired into the
    // batch path). Tracks Soulseek misses fall through to a timeout-guarded
    // Tidal fallback afterwards.
    const missedBySoulseek = new Set<MusicTrackId>();
    const sockseekQueries: SockseekBatchTrackQuery[] = queries.map((q) => ({
      key: q.key,
      artist: q.artist,
      title: q.title,
      durationSeconds: q.durationSeconds,
      album: q.album,
    }));

    // `_index.csv` poller: sockseek's stdout event stream drops settlements
    // under load, so poll its authoritative per-track index and fast-persist
    // any downloaded (or explicitly failed) track the callbacks missed.
    const indexCsvFile = this.sockseekAcquirer.batchIndexCsvPath(batchId, '');
    let pollTimer: NodeJS.Timeout | undefined;
    let polling = false;
    const pollIndexCsv = async () => {
      if (polling) {
        return;
      }
      polling = true;
      try {
        await this.reconcileFromIndexCsv(batchId, indexCsvFile, {
          queries,
          trackById,
          persisted,
          pendingVerification,
        });
      } catch (error) {
        this.logger.warn('index-csv reconciliation pass failed', { batchId, error: String(error) });
      } finally {
        polling = false;
      }
    };

    // Run the poller concurrently with acquireBatch, not after.
    pollTimer = setInterval(() => {
      void pollIndexCsv();
    }, INDEX_CSV_POLL_MS);

    try {
      await this.sockseekAcquirer.acquireBatch(batchId, sockseekQueries, '', CONCURRENT_JOBS, {
        onTrackSearchStart: (key) => {
          this.updateTrackStatus(batchId, key as MusicTrackId, 'downloading').catch((error) =>
            this.logger.error('Failed to publish downloading status', { batchId, key, error }),
          );
        },
        onTrackSettled: (key, outcome) => {
          const trackId = key as MusicTrackId;
          if (outcome.status === 'succeeded') {
            if (persisted.has(trackId)) {
              return;
            }
            persisted.add(trackId);
            trackPersist(
              this.fastPersist(
                batchId,
                trackId,
                outcome.result,
                'soulseek',
                trackById.get(trackId),
                pendingVerification,
              ).catch((error) =>
                this.logger.error('Failed to handle track settlement', { batchId, key, error }),
              ),
            );
          } else if (outcome.status === 'interrupted') {
            this.updateTrackStatus(
              batchId,
              trackId,
              'cancelled',
              'Interrupted by batch timeout before completion',
            ).catch(() => undefined);
          } else {
            // not-found: defer the failed/fallback decision to the Tidal pass.
            missedBySoulseek.add(trackId);
          }
        },
      });
    } finally {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
    // One final reconciliation pass after the process exits.
    await pollIndexCsv();

    // Timeout-guarded Tidal fallback for Soulseek misses (only those the poller
    // didn't already rescue).
    const misses = queries.filter(
      (q) => missedBySoulseek.has(q.key) && !persisted.has(q.key),
    );
    if (misses.length > 0) {
      const matches = await mapWithConcurrency(misses, TIDAL_SEARCH_CONCURRENCY, async (query) => {
        try {
          const match = await withTimeout(
            this.tidalDlAcquirer.findMatch(query.artist, query.title, query.durationSeconds),
            TIDAL_FALLBACK_TIMEOUT_MS,
            'Tidal search',
          );
          return { query, match };
        } catch (error) {
          this.logger.warn('Tidal fallback search failed/timed out', {
            trackId: query.key,
            error: String(error),
          });
          return { query, match: null };
        }
      });

      for (const { query, match } of matches) {
        if (persisted.has(query.key)) {
          continue;
        }
        if (!match) {
          await this.updateTrackStatus(batchId, query.key, 'failed', 'No match found on any source');
          continue;
        }
        let result: HqAudioAcquireResult | null = null;
        try {
          result = await withTimeout(
            this.tidalDlAcquirer.downloadMatch(match, ''),
            TIDAL_FALLBACK_TIMEOUT_MS,
            'Tidal download',
          );
        } catch (error) {
          this.logger.warn('Tidal fallback download failed/timed out', {
            trackId: query.key,
            error: String(error),
          });
        }
        if (!result) {
          await this.updateTrackStatus(batchId, query.key, 'failed', 'No match found on any source');
          continue;
        }
        persisted.add(query.key);
        await this.fastPersist(
          batchId,
          query.key,
          result,
          'tidal',
          trackById.get(query.key),
          pendingVerification,
        );
      }
    }

    // Drain the fire-and-forget fast-persists from the settle callbacks so the
    // verify tail sees every queued track.
    await Promise.all(persistTasks);

    // Slow tail: spectral verify + tag, bounded so a big batch doesn't open
    // dozens of concurrent multi-MB uploads to ai-service. Never changes the
    // already-'succeeded' status.
    if (pendingVerification.length > 0) {
      await mapWithConcurrency(pendingVerification, VERIFY_CONCURRENCY, (pv) =>
        this.verifyAndTag(pv),
      );
    }
  }

  /**
   * Reconcile the batch against sockseek's `_index.csv` — the authoritative
   * per-track record it writes as jobs finish. Fast-persists any downloaded
   * track the stdout event stream missed, and fails any track sockseek marked
   * failed. Idempotent (`persisted` guard).
   */
  private async reconcileFromIndexCsv(
    batchId: HqAudioBatchId,
    indexCsvFile: string,
    ctx: {
      queries: BatchTrackQuery[];
      trackById: Map<MusicTrackId, MusicTrack>;
      persisted: Set<MusicTrackId>;
      pendingVerification: PendingVerification[];
    },
  ): Promise<void> {
    const rows = await readIndexCsvRowsAt(indexCsvFile);
    for (const row of rows) {
      const trackId = ctx.queries[row.index]?.key;
      if (!trackId || ctx.persisted.has(trackId)) {
        continue;
      }
      if (row.state === 'downloaded' && row.filepath) {
        const format = extToFormat(row.filepath);
        if (!format) {
          continue;
        }
        ctx.persisted.add(trackId);
        await this.fastPersist(
          batchId,
          trackId,
          { filePath: row.filepath, format },
          'soulseek',
          ctx.trackById.get(trackId),
          ctx.pendingVerification,
        );
      }
      // `state==='failed'` is left for the Tidal fallback pass — sockseek
      // failing doesn't mean no source has it.
    }
  }

  /**
   * Phase A: put the file in the DB and flip the batch counter to 'succeeded'
   * immediately. The slow spectral verify + tag are queued into
   * `pendingVerification` for phase B.
   */
  private async fastPersist(
    batchId: HqAudioBatchId,
    trackId: MusicTrackId,
    result: HqAudioAcquireResult,
    source: 'tidal' | 'soulseek',
    track: MusicTrack | undefined,
    pendingVerification: PendingVerification[],
  ): Promise<void> {
    try {
      if (!(await fileExists(result.filePath))) {
        this.logger.error('Acquired HQ file is missing from disk, not persisting', {
          trackId,
          source,
          filePath: result.filePath,
        });
        await this.updateTrackStatus(batchId, trackId, 'failed', 'Acquired file not found on disk');
        return;
      }
      await this.musicTrackRepository.updateOneById(trackId, {
        hqAudioPath: result.filePath,
        hqAudioSource: source,
      });
      this.logger.info('persisted HQ audio (verification pending)', {
        trackId,
        source,
        hqAudioPath: result.filePath,
      });
      await this.updateTrackStatus(batchId, trackId, 'succeeded');
      pendingVerification.push({ trackId, filePath: result.filePath, format: result.format, track });
    } catch (error) {
      this.logger.error('Failed to persist acquired HQ audio', {
        trackId,
        source,
        error: String(error),
      });
      await this.updateTrackStatus(
        batchId,
        trackId,
        'failed',
        `Persist failed: ${String(error)}`,
      );
    }
  }

  /**
   * Phase B: spectral verify + tag for an already-persisted track. Runs after
   * the batch has reported it 'succeeded'. Failure only leaves
   * `hqAudioVerified=false` in the DB; the UI picks up the flag on its next
   * playlist refetch. Never touches batch status.
   */
  private async verifyAndTag(pv: PendingVerification): Promise<void> {
    try {
      const verification = await this.verify(pv.filePath, pv.format);
      await this.musicTrackRepository.updateOneById(pv.trackId, {
        hqAudioVerified: verification.verified,
        hqAudioSpectralCutoffHz: verification.cutoffHz ?? undefined,
      });
    } catch (error) {
      this.logger.warn('verify tail failed (track stays succeeded, unverified)', {
        trackId: pv.trackId,
        error: String(error),
      });
    }
    if (pv.track) {
      await this.hqAudioTagger.tagInPlace(pv.filePath, pv.track).catch(() => undefined);
    }
  }

  /**
   * Spectral fake-lossless check for a batch-acquired file. Unlike the
   * single-track composite cascade, the batch keeps a flagged file (there is no
   * cheap "try the next source" here) but records verified=false so the UI can
   * surface it and a later re-check can replace it.
   */
  private async verify(
    filePath: string,
    format: string,
  ): Promise<{ verified: boolean; cutoffHz: number | null }> {
    const verifiable = format === 'flac' || format === 'wav' || format === 'aiff';
    if (!this.verifyLossless || !verifiable) {
      return { verified: false, cutoffHz: null };
    }
    try {
      const v = await this.hqAudioVerifier.verify(filePath);
      if (!v.verified) {
        this.logger.warn('Batch HQ file failed spectral verification (kept, flagged)', {
          filePath,
          cutoffHz: v.cutoffHz,
          reason: v.reason,
        });
      }
      return { verified: v.verified, cutoffHz: v.cutoffHz };
    } catch (error) {
      this.logger.warn('Batch spectral verification errored, leaving file unverified', {
        filePath,
        error: String(error),
      });
      return { verified: false, cutoffHz: null };
    }
  }

  private async updateTrackStatus(
    batchId: HqAudioBatchId,
    trackId: MusicTrackId,
    status: HqAudioTrackStatus,
    errorMessage?: string,
  ): Promise<void> {
    const nextState = await this.hqAudioBatchProgressPublisher.updateTrackStatus(
      batchId,
      trackId,
      status,
      errorMessage,
    );
    if (!nextState) {
      // Batch state missing (never persisted / expired), track already settled,
      // or the track isn't in the batch. A missing batch means the frontend gets
      // no progress at all, so log it rather than swallowing silently.
      this.logger.warn('Batch progress update had no effect (missing state or already settled)', {
        batchId,
        trackId,
        status,
      });
      return;
    }

    const updatedTrack = nextState.tracks.find((track) => track.trackId === trackId);
    await this.hqAudioBatchProgressPublisher.publishEvent(batchId, {
      type: nextState.status === 'completed' ? 'batch.complete' : 'track.update',
      batchId,
      timestamp: nextState.updatedAt,
      track: updatedTrack,
      state: nextState,
    });
  }

  async cancel(batchId: HqAudioBatchId): Promise<boolean> {
    const nextState: HqAudioBatchState | null =
      await this.hqAudioBatchProgressPublisher.cancelBatch(batchId);
    if (!nextState) {
      return false;
    }

    await this.hqAudioBatchProgressPublisher.publishEvent(batchId, {
      type: 'batch.cancelled',
      batchId,
      timestamp: nextState.updatedAt,
      state: nextState,
    });

    this.sockseekAcquirer.cancelBatch(batchId);
    return true;
  }
}
