import { Maybe } from 'src/kernel/common';
import { GenreId, MusicLibraryId, SubgenreId } from 'src/kernel/ids';

export type PlaylistFilter = {
  genreIds: Maybe<GenreId[]>;
  subgenreIds: Maybe<SubgenreId[]>;
  atmospheres: Maybe<string[]>;
  libraryIds: Maybe<MusicLibraryId[]>;
  tempo: Maybe<{ min?: number; max?: number }>;
};

export interface CreatePlaylistInput {
  name: string;
  description: Maybe<string>;
  isPublic: Maybe<boolean>;
  filters: Maybe<PlaylistFilter>;
  maxTracks: Maybe<number>;
  subgenreSelectionMode: Maybe<'exact' | 'contain'>;
}
