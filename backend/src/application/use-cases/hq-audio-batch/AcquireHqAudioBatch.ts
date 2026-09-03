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
import {
  SockseekAcquirer,
  SockseekBatchTrackOutcome,
  SockseekBatchTrackQuery,
} from 'src/infrastructure/hq-audio/sockseek.acquirer';
import { TidalDlAcquirer } from 'src/infrastructure/hq-audio/tidal-dl.acquirer';
import { HqAudioBatchId, MusicTrackId } from 'src/kernel/ids';
import { mapWithConcurrency } from 'src/kernel/utils/concurrency';

const CONCURRENT_JOBS = 5;
/** Tidal pre-pass: one search + one CLI spawn per track, so keep this modest. */
const TIDAL_PREPASS_CONCURRENCY = 3;

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

    // Pre-pass: try Tidal for every track (bounded concurrency), then hand only
    // the misses to sockseek's batch search. Tidal has richer metadata and does
    // not lean on Soulseek peer availability, so it lifts the batch hit-rate.
    const tidalResults = await mapWithConcurrency(
      queries,
      TIDAL_PREPASS_CONCURRENCY,
      async (query) => {
        await this.updateTrackStatus(batchId, query.key, 'downloading');
        return { query, result: await this.tryTidal(query) };
      },
    );

    const sockseekQueries: SockseekBatchTrackQuery[] = [];
    for (const { query, result } of tidalResults) {
      if (result) {
        const verification = await this.verify(result.filePath, result.format);
        const track = trackById.get(query.key);
        if (track) {
          await this.hqAudioTagger.tagInPlace(result.filePath, track);
        }
        await this.musicTrackRepository.updateOneById(query.key, {
          hqAudioPath: result.filePath,
          hqAudioSource: 'tidal',
          hqAudioVerified: verification.verified,
          hqAudioSpectralCutoffHz: verification.cutoffHz ?? undefined,
        });
        await this.updateTrackStatus(batchId, query.key, 'succeeded');
      } else {
        sockseekQueries.push(query);
      }
    }

    if (sockseekQueries.length === 0) {
      return;
    }

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
        ).catch((error) =>
          this.logger.error('Failed to handle track settlement', { batchId, key, error }),
        );
      },
    });
  }

  private async tryTidal(query: BatchTrackQuery) {
    try {
      return await this.tidalDlAcquirer.acquire(
        query.artist,
        query.title,
        query.durationSeconds,
        '',
      );
    } catch (error) {
      this.logger.warn('Tidal acquisition failed in batch, falling back to sockseek', {
        trackId: query.key,
        artist: query.artist,
        title: query.title,
        error: String(error),
      });
      return null;
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
    track?: import('src/kernel/types/model-types').MusicTrack,
  ): Promise<void> {
    if (outcome.status === 'succeeded') {
      const verification = await this.verify(
        outcome.result.filePath,
        outcome.result.format,
      );
      if (track) {
        await this.hqAudioTagger.tagInPlace(outcome.result.filePath, track);
      }
      await this.musicTrackRepository.updateOneById(trackId, {
        hqAudioPath: outcome.result.filePath,
        hqAudioSource: 'soulseek',
        hqAudioVerified: verification.verified,
        hqAudioSpectralCutoffHz: verification.cutoffHz ?? undefined,
      });
      await this.updateTrackStatus(batchId, trackId, 'succeeded');
    } else if (outcome.status === 'interrupted') {
      await this.updateTrackStatus(
        batchId,
        trackId,
        'cancelled',
        'Interrupted by batch timeout before completion',
      );
    } else {
      await this.updateTrackStatus(batchId, trackId, 'failed', 'No match found on Soulseek');
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
      // Batch missing, or track already settled (e.g. cancelled) — ignore late/stale updates.
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
