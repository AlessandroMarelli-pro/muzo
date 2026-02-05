type Branding<BrandT> = {
  _type: BrandT;
};

export type Brand<T, BrandT extends string> = T & Branding<BrandT>;

export type PlaylistId = Brand<string, 'PlaylistId'>;

export type UserId = Brand<string, 'UserId'>;

export type PlaylistTrackId = Brand<string, 'PlaylistTrackId'>;

export type MusicTrackId = Brand<string, 'MusicTrackId'>;

export type PlaylistSortingId = Brand<string, 'PlaylistSortingId'>;

export type MusicLibraryId = Brand<string, 'MusicLibraryId'>;

export type ImageSearchId = Brand<string, 'ImageSearchId'>;

export type TrackGenreId = Brand<string, 'TrackGenreId'>;

export type TrackSubgenreId = Brand<string, 'TrackSubgenreId'>;

export type GenreId = Brand<string, 'GenreId'>;

export type SubgenreId = Brand<string, 'SubgenreId'>;

export type SavedFilterId = Brand<string, 'SavedFilterId'>;

export type QueueItemId = Brand<string, 'QueueItemId'>;

export type HiddenMusicTrackId = Brand<string, 'HiddenMusicTrackId'>;
