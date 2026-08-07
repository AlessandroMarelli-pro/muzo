import { HqAudioBatchId, MusicTrackId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';
import { createToken } from '../../utils/create-token';

export const HQ_AUDIO_BATCH_ACQUIRE_PRODUCER = createToken<IHqAudioBatchAcquireProducer>(
  'HQ_AUDIO_BATCH_ACQUIRE_PRODUCER',
);

export interface IHqAudioBatchAcquireProducer {
  scheduleBatch(
    batchId: HqAudioBatchId,
    trackIds: MusicTrackId[],
    contextUser: ActionContext['user'],
  ): Promise<void>;
}
