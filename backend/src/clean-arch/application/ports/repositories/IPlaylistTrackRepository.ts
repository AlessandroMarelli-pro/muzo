import { MusicTrackId, PlaylistId } from 'src/clean-arch/kernel/ids';
import { PlaylistTrack } from '../../../kernel/types/model-types';

export const PLAYLIST_TRACK_REPOSITORY = Symbol('IPlaylistTrackRepository');

export type PlaylistTrackPresence = {
  playlistId: PlaylistId;
  trackId: MusicTrackId;
  presence: boolean;
};
export interface IPlaylistTrackRepository {
  getTracksByPlaylistId(playlistId: PlaylistId): Promise<PlaylistTrack[]>;
  getTracks(): Promise<PlaylistTrack[]>;
  getPresenceBatch(
    pairs: Array<{ playlistId: PlaylistId; trackId: MusicTrackId }>,
  ): Promise<PlaylistTrackPresence[]>;
}
