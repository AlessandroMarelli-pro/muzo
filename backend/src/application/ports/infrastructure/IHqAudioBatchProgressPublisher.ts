import { HqAudioBatchId } from 'src/kernel/ids';
import { createToken } from '../../utils/create-token';
import { HqAudioBatchProgressEvent, HqAudioBatchState } from '../dtos/HqAudioBatchProgress.types';

export const HQ_AUDIO_BATCH_PROGRESS_PUBLISHER = createToken<IHqAudioBatchProgressPublisher>(
  'HQ_AUDIO_BATCH_PROGRESS_PUBLISHER',
);

export interface IHqAudioBatchProgressPublisher {
  publishEvent(batchId: HqAudioBatchId, event: HqAudioBatchProgressEvent): Promise<void>;
  setState(batchId: HqAudioBatchId, state: HqAudioBatchState): Promise<void>;
}
