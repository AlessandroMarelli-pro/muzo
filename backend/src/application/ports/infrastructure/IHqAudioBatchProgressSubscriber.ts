import { Observable } from 'rxjs';
import { HqAudioBatchId } from 'src/kernel/ids';
import { createToken } from '../../utils/create-token';
import { HqAudioBatchProgressEvent, HqAudioBatchState } from '../dtos/HqAudioBatchProgress.types';

export const HQ_AUDIO_BATCH_PROGRESS_SUBSCRIBER = createToken<IHqAudioBatchProgressSubscriber>(
  'HQ_AUDIO_BATCH_PROGRESS_SUBSCRIBER',
);

export interface IHqAudioBatchProgressSubscriber {
  subscribeToBatch(batchId: HqAudioBatchId): Promise<void>;
  unsubscribeFromBatch(batchId: HqAudioBatchId): Promise<void>;
  getEventStream(batchId: HqAudioBatchId): Observable<HqAudioBatchProgressEvent>;
  getCurrentState(batchId: HqAudioBatchId): Promise<HqAudioBatchState | null>;
}
