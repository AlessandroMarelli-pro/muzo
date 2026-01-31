import { PlaylistSortingId } from 'src/clean-arch/kernel/ids';
import {
  PlaylistSorting,
  PlaylistSortingDirection,
  PlaylistSortingKey,
} from 'src/clean-arch/kernel/types';

export type PlaylistSortingUpdateData = {
  sortingKey?: PlaylistSortingKey;
  sortingDirection?: PlaylistSortingDirection;
};

export interface IPlaylistSortingRepository {
  save(playlistSorting: PlaylistSorting): Promise<PlaylistSorting>;
  getOneById(id: PlaylistSortingId): Promise<PlaylistSorting>;
  getMany(): Promise<PlaylistSorting[]>;
  updateOneById(
    id: PlaylistSortingId,
    data: PlaylistSortingUpdateData,
  ): Promise<PlaylistSorting>;
  deleteOneById(id: PlaylistSortingId): Promise<boolean>;
}
