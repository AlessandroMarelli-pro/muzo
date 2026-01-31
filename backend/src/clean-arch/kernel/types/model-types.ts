import { Maybe } from '../common';
import type {
  Brand,
  MusicTrackId,
  PlaylistId,
  PlaylistSortingId,
  PlaylistTrackId,
  UserId,
} from '../ids'; // or your ids index
import { Email, Name } from './value-object';

export type ActionContext = {
  now: Date;
  user: User;
};

export type Model =
  | Playlist
  | User
  | PlaylistTrack
  | MusicTrack
  | PlaylistSorting;

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

export const playlistSortingKeys = ['addedAt', 'position'] as const;

export type PlaylistSortingKey = (typeof playlistSortingKeys)[number];

export const playlistSortingDirections = ['asc', 'desc'] as const;

export type PlaylistSortingDirection =
  (typeof playlistSortingDirections)[number];

export type PlaylistSorting = Readonly<ModelBase<PlaylistSortingId>> & {
  playlistId: PlaylistId;
  sortingKey: PlaylistSortingKey;
  sortingDirection: PlaylistSortingDirection;
};

export type MusicTrack = Readonly<ModelBase<MusicTrackId>> & {
  title: string;
  artist: string;
  duration: number;
  date: Date;
  isFavorite: boolean;
  isLiked: boolean;
  isBanger: boolean;
};
