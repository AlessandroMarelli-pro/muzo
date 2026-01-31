import { MusicTrackId, PlaylistId } from 'src/clean-arch/kernel/ids';
import {
  PlaylistSortingDirection,
  PlaylistSortingKey,
  PlaylistTrack,
} from '../../../kernel/types/model-types';
import { PlaylistTrackWithTrackDetail } from '../../dtos/PlaylistTrackWithDetail';

export const PLAYLIST_TRACK_REPOSITORY = Symbol('IPlaylistTrackRepository');

export type PlaylistTrackPresence = {
  playlistId: PlaylistId;
  trackId: MusicTrackId;
  presence: boolean;
};
export type PlaylistSortingOptions = {
  sortingKey?: PlaylistSortingKey;
  sortingDirection?: PlaylistSortingDirection;
};
export interface IPlaylistTrackRepository {
  getTracksByPlaylistId(playlistId: PlaylistId): Promise<PlaylistTrack[]>;
  getTracks(): Promise<PlaylistTrack[]>;
  getTracksWithTrack(): Promise<PlaylistTrackWithTrackDetail[]>;
  getTrackForPlaylist(
    playlistId: PlaylistId,
    trackId: MusicTrackId,
  ): Promise<PlaylistTrackWithTrackDetail>;
  getTracksByPlaylistIdWithTrack(
    playlistId: PlaylistId,
    sorting?: PlaylistSortingOptions,
  ): Promise<PlaylistTrackWithTrackDetail[]>;
  getPresenceBatch(
    pairs: Array<{ playlistId: PlaylistId; trackId: MusicTrackId }>,
  ): Promise<PlaylistTrackPresence[]>;
}
