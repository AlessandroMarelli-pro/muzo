import { MusicTrackId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';
import { createToken } from '../../utils/create-token';

export const DISCOGS_RESOLVE_PRODUCER =
  createToken<IDiscogsResolveProducer>('DISCOGS_RESOLVE_PRODUCER');

export interface IDiscogsResolveProducer {
  scheduleDiscogsResolve(trackId: MusicTrackId, contextUser: ActionContext['user']): Promise<void>;
}
