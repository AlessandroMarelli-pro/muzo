import { Maybe } from 'src/clean-arch/kernel/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import {
  FilterCriteria,
  MusicTrack,
} from 'src/clean-arch/kernel/types/model-types';

export const MUSIC_TRACK_REPOSITORY = Symbol('IMusicTrackRepository');

export interface IMusicTrackRepository {
  getOneById(id: MusicTrackId): Promise<MusicTrack>;
  getManyByIds(ids: MusicTrackId[]): Promise<MusicTrack[]>;
  getAll(): Promise<MusicTrack[]>;
  verifyExistence(id: MusicTrackId): Promise<boolean>;
  getManyByCriteria(
    criteria: FilterCriteria,
    skipGenres: boolean,
    skipSubgenres: boolean,
    subgenreSelectionMode: 'exact' | 'contain',
    options: {
      limit?: Maybe<number>;
      offset?: Maybe<number>;
      orderBy?: Maybe<string>;
      orderDirection?: Maybe<'asc' | 'desc'>;
    },
  ): Promise<MusicTrack[]>;
  getRandomTrackId(): Promise<MusicTrackId>;
}
