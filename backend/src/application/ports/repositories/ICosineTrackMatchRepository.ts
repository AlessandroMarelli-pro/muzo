import { Maybe } from 'src/kernel/common';
import { MusicTrackId } from 'src/kernel/ids';
import { CosineTrackMatch } from 'src/kernel/types/model-types';
import { createToken } from '../../utils/create-token';

export type CosineTrackMatchMethod = 'search' | 'youtube-lookup';

export type UpsertCosineTrackMatchData = {
  musicTrackId: MusicTrackId;
  cosineTrackId: string;
  matchMethod: CosineTrackMatchMethod;
};

export const COSINE_TRACK_MATCH_REPOSITORY = createToken<ICosineTrackMatchRepository>(
  'COSINE_TRACK_MATCH_REPOSITORY',
);

export interface ICosineTrackMatchRepository {
  /** The stored cosine.club id for a local track, or null if never resolved. */
  findByMusicTrackId(musicTrackId: MusicTrackId): Promise<Maybe<CosineTrackMatch>>;
  upsert(data: UpsertCosineTrackMatchData): Promise<CosineTrackMatch>;
  /** Drops a stale mapping so the next recommendation request re-resolves it. */
  deleteByMusicTrackId(musicTrackId: MusicTrackId): Promise<boolean>;
}
