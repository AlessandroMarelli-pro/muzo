import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import {
  FilterCriteria,
  MusicTrack,
} from 'src/clean-arch/kernel/types/model-types';
import {
  CursorPaginationResult,
  PaginationAndSortingOptions,
  PaginationResult,
  WithCursorPagination,
  WithPagination,
} from 'src/clean-arch/kernel/types/pagination';
import { createToken } from '../../utils/create-token';

export const MUSIC_TRACK_REPOSITORY = createToken<IMusicTrackRepository>(
  'MUSIC_TRACK_REPOSITORY',
);

export type MusicTrackUpdateData = {
  stats?: {
    isFavorite?: boolean;
    isBanger?: boolean;
    isLiked?: boolean;
  };
};

export interface IMusicTrackRepository {
  getOneById(id: MusicTrackId): Promise<MusicTrack>;
  getLastPlayedTrack(): Promise<MusicTrack>;
  getManyByIds(ids: MusicTrackId[]): Promise<MusicTrack[]>;
  getAll(): Promise<MusicTrack[]>;
  verifyExistence(id: MusicTrackId): Promise<boolean>;
  getManyByCriteria(
    criteria: FilterCriteria,
    subgenreSelectionMode: 'exact' | 'contain',
    options: PaginationAndSortingOptions,
    withIncludes?: boolean,
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
  incrementListeningCount(id: MusicTrackId): Promise<MusicTrack>;
}
