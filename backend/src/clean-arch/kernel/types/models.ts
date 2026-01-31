import { MusicTrackId, PlaylistId, PlaylistTrackId, UserId } from '../ids';
import { modelIdFactory } from '../ids/factory';
import { modelFactory } from './factory';
import { MusicTrack, Playlist, PlaylistTrack, User } from './model-types';

export const models = {
  playlist: modelFactory<Playlist, PlaylistId>(modelIdFactory('Playlist')),
  user: modelFactory<User, UserId>(modelIdFactory('User')),
  playlistTrack: modelFactory<PlaylistTrack, PlaylistTrackId>(
    modelIdFactory('PlaylistTrack'),
  ),
  musicTrack: modelFactory<MusicTrack, MusicTrackId>(
    modelIdFactory('MusicTrack'),
  ),
};
