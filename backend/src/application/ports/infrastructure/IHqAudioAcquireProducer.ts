import { MusicTrackId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';
import { createToken } from '../../utils/create-token';

export const HQ_AUDIO_ACQUIRE_PRODUCER =
  createToken<IHqAudioAcquireProducer>('HQ_AUDIO_ACQUIRE_PRODUCER');

export interface IHqAudioAcquireProducer {
  scheduleHqAudioAcquire(trackId: MusicTrackId, contextUser: ActionContext['user']): Promise<void>;
}
