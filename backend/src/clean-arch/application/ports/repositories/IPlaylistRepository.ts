import { Maybe } from 'src/clean-arch/kernel/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { Playlist, PlaylistSorting } from '../../../kernel/types/model-types';
import { PlaylistTrackWithTrackDetail } from '../../dtos/PlaylistTrackWithDetail';
import { PlaylistSortingOptions } from './IPlaylistTrackRepository';

export type PlaylistUpdateData = {
  name?: string;
  description?: Maybe<string>;
  isPublic?: boolean;
};

export const PLAYLIST_REPOSITORY = Symbol('IPlaylistRepository');

export type PlaylistWithSorting = Playlist & {
  sorting: Maybe<PlaylistSorting>;
};
export type PlaylistWithSortingAndTracks = PlaylistWithSorting & {
  tracks: PlaylistTrackWithTrackDetail[];
};

export interface IPlaylistRepository {
  save(playlist: Playlist): Promise<Playlist>;
  getOneById(id: PlaylistId): Promise<PlaylistWithSorting>;
  getOneByIdWithTracks(
    id: PlaylistId,
    sorting: Maybe<PlaylistSortingOptions>,
  ): Promise<PlaylistWithSortingAndTracks>;
  getMany(): Promise<Playlist[]>;
  updateOneById(id: PlaylistId, data: PlaylistUpdateData): Promise<Playlist>;
  deleteOneById(id: PlaylistId): Promise<boolean>;
}
