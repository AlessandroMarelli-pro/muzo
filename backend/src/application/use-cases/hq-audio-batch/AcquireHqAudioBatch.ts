import {
  HqAudioBatchState,
  HqAudioTrackStatus,
} from 'src/application/ports/dtos/HqAudioBatchProgress.types';
import { IHqAudioBatchProgressPublisher } from 'src/application/ports/infrastructure/IHqAudioBatchProgressPublisher';
import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { IMusicTrackRepository } from 'src/application/ports/repositories/IMusicTrackRepository';
import {
  SockseekAcquirer,
  SockseekBatchTrackOutcome,
  SockseekBatchTrackQuery,
} from 'src/infrastructure/hq-audio/sockseek.acquirer';
import { TidalDlAcquirer } from 'src/infrastructure/hq-audio/tidal-dl.acquirer';
import { HqAudioBatchId, MusicTrackId } from 'src/kernel/ids';

const CONCURRENT_JOBS = 5;

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
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('AcquireHqAudioBatchUseCase');
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

    const sockseekQueries: SockseekBatchTrackQuery[] = [];
    for (const query of queries) {
      /*   await this.updateTrackStatus(batchId, query.key, 'downloading');
      const tidalResult = await this.tryTidal(query);
      if (tidalResult) {
        await this.musicTrackRepository.updateOneById(query.key, {
          hqAudioPath: tidalResult.filePath,
        });
        await this.updateTrackStatus(batchId, query.key, 'succeeded');
        continue;
      } */
      sockseekQueries.push(query);
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
        this.handleTrackSettled(batchId, key as MusicTrackId, outcome).catch((error) =>
          this.logger.error('Failed to handle track settlement', { batchId, key, error }),
        );
      },
    });
  }

  private async tryTidal(query: BatchTrackQuery): Promise<{ filePath: string } | null> {
    try {
      const result = await this.tidalDlAcquirer.acquire(
        query.artist,
        query.title,
        query.durationSeconds,
        '',
      );
      return result;
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

  private async handleTrackSettled(
    batchId: HqAudioBatchId,
    trackId: MusicTrackId,
    outcome: SockseekBatchTrackOutcome,
  ): Promise<void> {
    if (outcome.status === 'succeeded') {
      await this.musicTrackRepository.updateOneById(trackId, {
        hqAudioPath: outcome.result.filePath,
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
