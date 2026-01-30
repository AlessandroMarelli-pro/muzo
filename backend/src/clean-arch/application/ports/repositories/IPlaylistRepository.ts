import { PlaylistId, UserId } from 'src/clean-arch/kernel/ids';
import { Playlist } from '../../../kernel/types/model-types';

export const PLAYLIST_REPOSITORY = Symbol('IPlaylistRepository');

export interface IPlaylistRepository {
  save(playlist: Playlist): Promise<Playlist>;
  getOneById(id: PlaylistId): Promise<Playlist>;
  getManyByUserId(userId: UserId): Promise<Playlist[]>;
  updateOneById(id: PlaylistId, playlist: Playlist): Promise<Playlist>;
  deleteOneById(id: PlaylistId): Promise<boolean>;
}
