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
import { probeAudioCodec } from 'src/infrastructure/hq-audio/audio-probe';
import {
  SockseekAcquirer,
  SockseekBatchTrackOutcome,
  SockseekBatchTrackQuery,
} from 'src/infrastructure/hq-audio/sockseek.acquirer';
import {
  TidalDlAcquirer,
  TidalMatch,
} from 'src/infrastructure/hq-audio/tidal-dl.acquirer';
import { HqAudioBatchId, MusicTrackId } from 'src/kernel/ids';
import type { HqAudioAcquireResult } from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import type { MusicTrack } from 'src/kernel/types/model-types';
import { mapWithConcurrency } from 'src/kernel/utils/concurrency';

const CONCURRENT_JOBS = 5;
/** Tidal *search* runs in parallel; downloads are serialised inside the acquirer. */
const TIDAL_SEARCH_CONCURRENCY = 3;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
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

    // Pre-pass: search Tidal for every track in parallel, then download the
    // matches one at a time (the acquirer serialises `dl` internally, but we
    // also want deterministic per-track handling here). A lossless Tidal file
    // is persisted immediately; a lossy one (AAC — no HiFi entitlement) is
    // stashed and the track still goes to Soulseek for a lossless copy, with
    // the lossy file persisted afterwards only if Soulseek also misses.
    const matches = await mapWithConcurrency(
      queries,
      TIDAL_SEARCH_CONCURRENCY,
      async (query) => {
        await this.updateTrackStatus(batchId, query.key, 'downloading');
        return { query, match: await this.findTidalMatch(query) };
      },
    );

    const sockseekQueries: SockseekBatchTrackQuery[] = [];
    /** Tidal lossy files kept as a fallback if Soulseek also misses. */
    const tidalLossyFallback = new Map<MusicTrackId, HqAudioAcquireResult>();

    for (const { query, match } of matches) {
      if (!match) {
        sockseekQueries.push(query);
        continue;
      }

      let result: HqAudioAcquireResult | null = null;
      try {
        result = await this.tidalDlAcquirer.downloadMatch(match, '');
      } catch (error) {
        this.logger.warn('Tidal download failed in batch, falling back to sockseek', {
          trackId: query.key,
          artist: query.artist,
          title: query.title,
          error: String(error),
        });
      }

      if (!result) {
        sockseekQueries.push(query);
        continue;
      }

      const probed = await probeAudioCodec(result.filePath);
      if (probed && !probed.lossless) {
        this.logger.info('Tidal returned lossy codec in batch; trying Soulseek for lossless', {
          trackId: query.key,
          codec: probed.codec,
        });
        tidalLossyFallback.set(query.key, result);
        sockseekQueries.push(query);
        continue;
      }

      await this.persistAcquired(
        batchId,
        query.key,
        result,
        'tidal',
        trackById.get(query.key),
      );
    }

    if (sockseekQueries.length > 0) {
      await this.sockseekAcquirer.acquireBatch(batchId, sockseekQueries, '', CONCURRENT_JOBS, {
        onTrackSearchStart: (key) => {
          this.updateTrackStatus(batchId, key as MusicTrackId, 'downloading').catch((error) =>
            this.logger.error('Failed to publish downloading status', { batchId, key, error }),
          );
        },
        onTrackSettled: (key, outcome) => {
          this.handleTrackSettled(
            batchId,
            key as MusicTrackId,
            outcome,
            trackById.get(key as MusicTrackId),
            tidalLossyFallback.get(key as MusicTrackId),
          ).catch((error) =>
            this.logger.error('Failed to handle track settlement', { batchId, key, error }),
          );
        },
      });
    }
  }

  private async findTidalMatch(query: BatchTrackQuery): Promise<TidalMatch | null> {
    try {
      return await this.tidalDlAcquirer.findMatch(
        query.artist,
        query.title,
        query.durationSeconds,
      );
    } catch (error) {
      this.logger.warn('Tidal search failed in batch', {
        trackId: query.key,
        artist: query.artist,
        title: query.title,
        error: String(error),
      });
      return null;
    }
  }

  /**
   * verify → persist → mark succeeded → tag (best-effort, last). Isolated so one
   * track's failure never aborts the batch.
   */
  private async persistAcquired(
    batchId: HqAudioBatchId,
    trackId: MusicTrackId,
    result: HqAudioAcquireResult,
    source: 'tidal' | 'soulseek',
    track: MusicTrack | undefined,
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
      const verification = await this.verify(result.filePath, result.format);
      await this.musicTrackRepository.updateOneById(trackId, {
        hqAudioPath: result.filePath,
        hqAudioSource: source,
        hqAudioVerified: verification.verified,
        hqAudioSpectralCutoffHz: verification.cutoffHz ?? undefined,
      });
      this.logger.info('persisted HQ audio', {
        trackId,
        source,
        hqAudioPath: result.filePath,
        verified: verification.verified,
      });
      await this.updateTrackStatus(batchId, trackId, 'succeeded');
      if (track) {
        await this.hqAudioTagger.tagInPlace(result.filePath, track);
      }
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

  private async handleTrackSettled(
    batchId: HqAudioBatchId,
    trackId: MusicTrackId,
    outcome: SockseekBatchTrackOutcome,
    track?: MusicTrack,
    tidalLossyFallback?: HqAudioAcquireResult,
  ): Promise<void> {
    if (outcome.status === 'succeeded') {
      await this.persistAcquired(batchId, trackId, outcome.result, 'soulseek', track);
      return;
    }
    if (outcome.status === 'interrupted') {
      await this.updateTrackStatus(
        batchId,
        trackId,
        'cancelled',
        'Interrupted by batch timeout before completion',
      );
      return;
    }
    // not-found on Soulseek. If Tidal had a lossy copy, keep it now.
    if (tidalLossyFallback) {
      this.logger.info('Soulseek missed; keeping Tidal lossy fallback', { trackId });
      await this.persistAcquired(batchId, trackId, tidalLossyFallback, 'tidal', track);
      return;
    }
    await this.updateTrackStatus(batchId, trackId, 'failed', 'No match found on Soulseek');
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
