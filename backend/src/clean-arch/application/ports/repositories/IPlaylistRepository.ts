import { Maybe } from 'src/clean-arch/kernel/common';
import { PlaylistId, UserId } from 'src/clean-arch/kernel/ids';
import { Playlist } from '../../../kernel/types/model-types';

export type PlaylistUpdateData = {
  name?: string;
  description?: Maybe<string>;
  isPublic?: boolean;
  updatedById: UserId;
  updatedAt: Date;
};

export const PLAYLIST_REPOSITORY = Symbol('IPlaylistRepository');

export interface IPlaylistRepository {
  save(playlist: Playlist): Promise<Playlist>;
  getOneById(id: PlaylistId): Promise<Playlist>;
  getManyByUserId(userId: UserId): Promise<Playlist[]>;
  updateOneById(id: PlaylistId, data: PlaylistUpdateData): Promise<Playlist>;
  deleteOneById(id: PlaylistId): Promise<boolean>;
}
