import { MusicTrackId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';
import { createToken } from '../../utils/create-token';

export const EMBEDDING_BACKFILL_PRODUCER =
  createToken<IEmbeddingBackfillProducer>('EMBEDDING_BACKFILL_PRODUCER');

export interface IEmbeddingBackfillProducer {
  scheduleEmbeddingBackfill(
    tracks: { trackId: MusicTrackId; filePath: string }[],
    contextUser: ActionContext['user'],
  ): Promise<{ jobCount: number }>;
}
