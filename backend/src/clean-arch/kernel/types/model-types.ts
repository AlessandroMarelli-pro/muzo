import { Maybe } from '../common';
import type {
  Brand,
  MusicTrackId,
  PlaylistId,
  PlaylistTrackId,
  UserId,
} from '../ids'; // or your ids index
import { Email, Name } from './value-object';

export type ActionContext = {
  now: Date;
  user: User;
};

export type Model = Playlist | User | PlaylistTrack | MusicTrack;

export type ModelBase<
  Id extends string | Brand<T, string> = string,
  T = unknown,
> = {
  id: Id;
  createdAt: Date;
  createdById: UserId;
  updatedAt: Date;
  updatedById: Maybe<UserId>;
};

export type Playlist = Readonly<ModelBase<PlaylistId>> & {
  name: string;
  description: Maybe<string>;
  isPublic: boolean;
};

export type User = Readonly<
  ModelBase<UserId> & {
    email: Email;
    firstName: Maybe<Name>;
    lastName: Maybe<Name>;
  }
>;

export type PlaylistTrack = Readonly<ModelBase<PlaylistTrackId>> & {
  trackId: MusicTrackId;
  playlistId: PlaylistId;
  position: number;
  addedAt: Date;
};

export type MusicTrack = Readonly<ModelBase<MusicTrackId>> & {};
