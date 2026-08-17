import { MusicTrackId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';
import { createToken } from '../../utils/create-token';

export const HQ_AUDIO_ENHANCE_PRODUCER =
  createToken<IHqAudioEnhanceProducer>('HQ_AUDIO_ENHANCE_PRODUCER');

export interface IHqAudioEnhanceProducer {
  scheduleHqAudioEnhance(trackId: MusicTrackId, contextUser: ActionContext['user']): Promise<void>;
}
