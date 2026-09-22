import { MusicTrackId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';
import { createToken } from '../../utils/create-token';

export const BANDCAMP_RESOLVE_PRODUCER =
  createToken<IBandcampResolveProducer>('BANDCAMP_RESOLVE_PRODUCER');

export interface IBandcampResolveProducer {
  scheduleBandcampResolve(trackId: MusicTrackId, contextUser: ActionContext['user']): Promise<void>;
}
