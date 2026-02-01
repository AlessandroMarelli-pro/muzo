import {
  MusicTrackId,
  PlaylistId,
  PlaylistTrackId,
} from 'src/clean-arch/kernel/ids';
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

export type AddTrackToPlaylistData = {
  trackId: MusicTrackId;
  position?: number;
};

export type PlaylistSortingOptions = {
  sortingKey?: PlaylistSortingKey;
  sortingDirection?: PlaylistSortingDirection;
};

export type PlaylistTrackUpdateData = {
  position?: number;
};

export interface IPlaylistTrackRepository {
  save(playlistTrack: PlaylistTrack): Promise<PlaylistTrack>;
  updateOneById(
    id: PlaylistTrackId,
    data: PlaylistTrackUpdateData,
  ): Promise<PlaylistTrack>;
  decrementTracksPosition(
    playlistId: PlaylistId,
    startingPosition: number,
  ): Promise<boolean>;
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
  verifyPresence(
    playlistId: PlaylistId,
    trackId: MusicTrackId,
  ): Promise<boolean>;
  getLastPosition(playlistId: PlaylistId): Promise<number>;
  removeTrackFromPlaylist(
    playlistId: PlaylistId,
    trackId: MusicTrackId,
  ): Promise<PlaylistTrack>;
}
