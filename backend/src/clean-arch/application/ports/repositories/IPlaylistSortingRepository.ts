import { PlaylistId } from 'src/clean-arch/kernel/ids';
import {
  PlaylistSorting,
  PlaylistSortingDirection,
  PlaylistSortingKey,
} from 'src/clean-arch/kernel/types';

export type PlaylistSortingUpdateData = {
  sortingKey?: PlaylistSortingKey;
  sortingDirection?: PlaylistSortingDirection;
};
export const PLAYLIST_SORTING_REPOSITORY = Symbol('IPlaylistSortingRepository');

export interface IPlaylistSortingRepository {
  getByPlaylistId(playlistId: PlaylistId): Promise<PlaylistSorting>;
}
