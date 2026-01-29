import { PlaylistId, UserId } from '../ids';
import { modelIdFactory } from '../ids/factory';
import { modelFactory } from './factory';
import { Playlist, User } from './model-types';

export const models = {
  playlist: modelFactory<Playlist, PlaylistId>(modelIdFactory('Playlist')),
  user: modelFactory<User, UserId>(modelIdFactory('User')),
};
