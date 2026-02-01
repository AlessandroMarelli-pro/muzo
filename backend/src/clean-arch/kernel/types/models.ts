import {
  MusicLibraryId,
  MusicTrackId,
  PlaylistId,
  PlaylistSortingId,
  PlaylistTrackId,
  UserId,
} from '../ids';
import { modelIdFactory } from '../ids/factory';
import { modelFactory } from './factory';
import {
  MusicLibrary,
  MusicTrack,
  Playlist,
  PlaylistSorting,
  PlaylistTrack,
  User,
} from './model-types';

export const models = {
  playlist: modelFactory<Playlist, PlaylistId>(modelIdFactory('Playlist')),
  user: modelFactory<User, UserId>(modelIdFactory('User')),
  playlistTrack: modelFactory<PlaylistTrack, PlaylistTrackId>(
    modelIdFactory('PlaylistTrack'),
  ),
  playlistSorting: modelFactory<PlaylistSorting, PlaylistSortingId>(
    modelIdFactory('PlaylistSorting'),
  ),
  musicTrack: modelFactory<MusicTrack, MusicTrackId>(
    modelIdFactory('MusicTrack'),
  ),
  musicLibrary: modelFactory<MusicLibrary, MusicLibraryId>(
    modelIdFactory('MusicLibrary'),
  ),
};
