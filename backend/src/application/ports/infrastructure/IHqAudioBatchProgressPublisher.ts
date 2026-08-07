import { HqAudioBatchId } from 'src/kernel/ids';
import { createToken } from '../../utils/create-token';
import {
  HqAudioBatchProgressEvent,
  HqAudioBatchState,
  HqAudioTrackStatus,
} from '../dtos/HqAudioBatchProgress.types';

export const HQ_AUDIO_BATCH_PROGRESS_PUBLISHER = createToken<IHqAudioBatchProgressPublisher>(
  'HQ_AUDIO_BATCH_PROGRESS_PUBLISHER',
);

export interface IHqAudioBatchProgressPublisher {
  publishEvent(batchId: HqAudioBatchId, event: HqAudioBatchProgressEvent): Promise<void>;
  /** Writes the full initial (or replacement) batch state. Not for use under concurrent contention. */
  setState(batchId: HqAudioBatchId, state: HqAudioBatchState): Promise<void>;
  /**
   * Atomically transitions a single track's status and adjusts aggregate counters, immune to
   * lost updates from concurrently-settling tracks. Returns null if the track was already in a
   * terminal status (already settled) or the batch no longer exists, in which case no write happened.
   */
  updateTrackStatus(
    batchId: HqAudioBatchId,
    trackId: string,
    status: HqAudioTrackStatus,
    errorMessage?: string,
  ): Promise<HqAudioBatchState | null>;
  /** Atomically marks every queued/downloading track as cancelled and stops the batch. */
  cancelBatch(batchId: HqAudioBatchId): Promise<HqAudioBatchState | null>;
}
