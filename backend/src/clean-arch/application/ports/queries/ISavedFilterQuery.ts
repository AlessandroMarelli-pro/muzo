import { GenreId, MusicLibraryId, SubgenreId } from 'src/clean-arch/kernel/ids';

export const SAVED_FILTER_QUERY = Symbol('SAVED_FILTER_QUERY');

export type FilterWithID<T> = {
  id: T;
  name: string;
};

export type StaticFilterOptions = {
  genres: FilterWithID<GenreId>[];
  subgenres: FilterWithID<SubgenreId>[];
  keys: FilterWithID<string>[];
  libraries: FilterWithID<MusicLibraryId>[];
  atmospheres: FilterWithID<string>[];
};

export interface ISavedFilterQuery {
  getStaticFilterOptions(): Promise<StaticFilterOptions>;
}
