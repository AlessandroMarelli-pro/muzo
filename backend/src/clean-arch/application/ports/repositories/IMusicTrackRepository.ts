import { Maybe } from 'src/clean-arch/kernel/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import {
  FilterCriteria,
  MusicTrack,
} from 'src/clean-arch/kernel/types/model-types';
import {
  CursorPaginationResult,
  PaginationResult,
  WithCursorPagination,
  WithPagination,
} from 'src/clean-arch/kernel/types/pagination';

export const MUSIC_TRACK_REPOSITORY = Symbol('IMusicTrackRepository');

export type MusicTrackUpdateData = {
  stats?: {
    isFavorite?: boolean;
    isBanger?: boolean;
    isLiked?: boolean;
  };
};

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
  getManyByCriteriaWithPagination(
    criteria: FilterCriteria,
    pagination: WithPagination,
  ): Promise<PaginationResult<MusicTrack>>;
  getManyByCriteriaWithCursorPagination(
    criteria: FilterCriteria,
    pagination: WithCursorPagination<MusicTrack>,
  ): Promise<CursorPaginationResult<MusicTrack>>;
  getRandomTrackId(): Promise<MusicTrackId>;
  updateOneById(
    id: MusicTrackId,
    data: MusicTrackUpdateData,
  ): Promise<MusicTrack>;
  removeOneById(id: MusicTrackId): Promise<boolean>;
}
