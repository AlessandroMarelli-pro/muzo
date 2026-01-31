import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { PlaylistTrack } from '../../../kernel/types/model-types';

export const PLAYLIST_TRACK_REPOSITORY = Symbol('IPlaylistTrackRepository');

export interface IPlaylistTrackRepository {
  getTracksByPlaylistId(playlistId: PlaylistId): Promise<PlaylistTrack[]>;
  getTracks(): Promise<PlaylistTrack[]>;
}
