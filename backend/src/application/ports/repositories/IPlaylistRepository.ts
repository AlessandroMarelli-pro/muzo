import { Maybe, MaybeUndefined } from 'src/kernel/common';
import { PlaylistId } from 'src/kernel/ids';
import { Playlist, PlaylistSorting } from '../../../kernel/types/model-types';
import { createToken } from '../../utils/create-token';
import { PlaylistTrackWithTrackDetail } from '../dtos/PlaylistTrackWithDetail';
import { PlaylistTrackWithTrackDetailAndSorting } from '../dtos/PlaylistWithTrackDetailsAndSorting';
import { PlaylistSortingOptions } from './IPlaylistTrackRepository';

export type PlaylistUpdateData = {
  name?: string;
  description?: Maybe<string>;
  isPublic?: boolean;
};

export const PLAYLIST_REPOSITORY = createToken<IPlaylistRepository>('PLAYLIST_REPOSITORY');

export type PlaylistWithSorting = Playlist & {
  sorting: MaybeUndefined<PlaylistSorting>;
};
export type PlaylistWithSortingAndTracks = PlaylistWithSorting & {
  tracks: MaybeUndefined<PlaylistTrackWithTrackDetail[]>;
};

export interface IPlaylistRepository {
  save(playlist: Playlist): Promise<Playlist>;
  getOneById(id: PlaylistId): Promise<PlaylistWithSorting>;
  getOneByIdWithTracks(
    id: PlaylistId,
    sorting: Maybe<PlaylistSortingOptions>,
  ): Promise<PlaylistTrackWithTrackDetailAndSorting>;
  getFavorite(): Promise<PlaylistTrackWithTrackDetailAndSorting>;
  getMany(): Promise<Playlist[]>;
  updateOneById(id: PlaylistId, data: PlaylistUpdateData): Promise<Playlist>;
  deleteOneById(id: PlaylistId): Promise<boolean>;
  verifyAccess(id: PlaylistId): Promise<boolean>;
}
