import { Maybe } from 'src/clean-arch/kernel/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import {
  PlaylistSorting,
  PlaylistSortingDirection,
  PlaylistSortingKey,
} from 'src/clean-arch/kernel/types';
import { createToken } from '../../utils/create-token';

export type PlaylistSortingUpdateData = {
  sortingKey?: PlaylistSortingKey;
  sortingDirection?: PlaylistSortingDirection;
};
export const PLAYLIST_SORTING_REPOSITORY =
  createToken<IPlaylistSortingRepository>('PLAYLIST_SORTING_REPOSITORY');

export type PlaylistSortingUpsertData = {
  sortingKey: PlaylistSortingKey;
  sortingDirection: PlaylistSortingDirection;
};

export interface IPlaylistSortingRepository {
  save(data: PlaylistSorting): Promise<PlaylistSorting>;
  getByPlaylistId(playlistId: PlaylistId): Promise<Maybe<PlaylistSorting>>;
  update(
    playlistId: PlaylistId,
    data: PlaylistSortingUpdateData,
  ): Promise<PlaylistSorting>;
  verifyExistence(playlistId: PlaylistId): Promise<boolean>;
}
