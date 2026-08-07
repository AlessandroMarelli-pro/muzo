import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  HqAudioBatchProgressEvent,
  HqAudioBatchState,
  HqAudioBatchTrackState,
  HqAudioTrackStatus,
} from 'src/application/ports/dtos/HqAudioBatchProgress.types';
import { HqAudioBatchAcquireJobData } from 'src/application/ports/dtos/JobSchedulersData';
import {
  HQ_AUDIO_BATCH_PROGRESS_PUBLISHER,
  IHqAudioBatchProgressPublisher,
} from 'src/application/ports/infrastructure/IHqAudioBatchProgressPublisher';
import {
  HQ_AUDIO_BATCH_PROGRESS_SUBSCRIBER,
  IHqAudioBatchProgressSubscriber,
} from 'src/application/ports/infrastructure/IHqAudioBatchProgressSubscriber';
import { AcquireHqAudioViaSockseekUseCase } from 'src/application/use-cases/music-track/AcquireHqAudioViaSockseek';
import { als } from 'src/kernel/types/context';

function outcomeToStatus(
  outcome: Awaited<ReturnType<AcquireHqAudioViaSockseekUseCase['execute']>>,
): HqAudioTrackStatus {
  switch (outcome) {
    case 'succeeded':
      return 'succeeded';
    case 'skipped-already-hq':
    case 'skipped-missing-metadata':
      return 'skipped';
    case 'not-found':
    case 'no-source-found':
      return 'failed';
  }
}

@Processor('hq-audio-batch-acquire', { concurrency: 5 })
export class HqAudioBatchAcquireConsumerAdapter extends WorkerHost {
  private readonly logger = new Logger(HqAudioBatchAcquireConsumerAdapter.name);

  constructor(
    private readonly acquireHqAudioViaSockseekUseCase: AcquireHqAudioViaSockseekUseCase,
    @Inject(HQ_AUDIO_BATCH_PROGRESS_PUBLISHER)
    private readonly publisher: IHqAudioBatchProgressPublisher,
    @Inject(HQ_AUDIO_BATCH_PROGRESS_SUBSCRIBER)
    private readonly subscriber: IHqAudioBatchProgressSubscriber,
  ) {
    super();
  }

  async process(job: Job<HqAudioBatchAcquireJobData>): Promise<void> {
    const { contextUser, trackId, batchId } = job.data;
    return als.run({ now: new Date(), user: contextUser }, async () => {
      switch (job.name) {
        case 'hq-audio-batch-acquire':
          await this.processTrack(batchId, trackId);
          break;
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    });
  }

  private async processTrack(
    batchId: HqAudioBatchAcquireJobData['batchId'],
    trackId: HqAudioBatchAcquireJobData['trackId'],
  ): Promise<void> {
    await this.updateTrackStatus(batchId, trackId, 'downloading');

    let outcome: Awaited<ReturnType<AcquireHqAudioViaSockseekUseCase['execute']>>;
    try {
      outcome = await this.acquireHqAudioViaSockseekUseCase.execute(trackId);
    } catch (error) {
      this.logger.error(`Failed to acquire HQ audio for track ${trackId} in batch ${batchId}:`, error);
      await this.updateTrackStatus(batchId, trackId, 'failed', error.message);
      return;
    }

    await this.updateTrackStatus(batchId, trackId, outcomeToStatus(outcome));
  }

  private async updateTrackStatus(
    batchId: HqAudioBatchAcquireJobData['batchId'],
    trackId: HqAudioBatchAcquireJobData['trackId'],
    status: HqAudioTrackStatus,
    errorMessage?: string,
  ): Promise<void> {
    const currentState = await this.subscriber.getCurrentState(batchId);
    if (!currentState) {
      this.logger.warn(`No state found for batch ${batchId} while updating track ${trackId}`);
      return;
    }

    const nextState = applyTrackStatus(currentState, trackId, status, errorMessage);
    await this.publisher.setState(batchId, nextState);

    const updatedTrack = nextState.tracks.find((track) => track.trackId === trackId);
    const event: HqAudioBatchProgressEvent = {
      type: nextState.status === 'completed' ? 'batch.complete' : 'track.update',
      batchId,
      timestamp: nextState.updatedAt,
      track: updatedTrack,
      state: nextState,
    };
    await this.publisher.publishEvent(batchId, event);
  }
}

function applyTrackStatus(
  state: HqAudioBatchState,
  trackId: string,
  status: HqAudioTrackStatus,
  errorMessage?: string,
): HqAudioBatchState {
  let previousStatus: HqAudioTrackStatus | undefined;
  const tracks: HqAudioBatchTrackState[] = state.tracks.map((track) => {
    if (track.trackId !== trackId) {
      return track;
    }
    previousStatus = track.status;
    return { ...track, status, errorMessage };
  });

  const counts = {
    queued: state.queued,
    downloading: state.downloading,
    succeeded: state.succeeded,
    failed: state.failed,
    skipped: state.skipped,
  };
  if (previousStatus) {
    counts[previousStatus as keyof typeof counts]--;
  }
  counts[status as keyof typeof counts]++;

  const isBatchComplete = counts.queued === 0 && counts.downloading === 0;

  return {
    ...state,
    ...counts,
    tracks,
    status: isBatchComplete ? 'completed' : 'running',
    updatedAt: new Date().toISOString(),
  };
}
