import {
  AiServiceSettingsId,
  CosineTrackMatchId,
  GenreId,
  HiddenMusicTrackId,
  ImageSearchId,
  MusicLibraryId,
  MusicTrackId,
  PlaylistId,
  PlaylistSortingId,
  PlaylistTrackId,
  QueueItemId,
  SavedFilterId,
  SessionId,
  SubgenreId,
  TrackGenreId,
  TrackSubgenreId,
  UserId,
} from '../ids';
import { modelIdFactory } from '../ids/factory';
import { modelFactory } from './factory';
import {
  AiServiceSettings,
  CosineTrackMatch,
  Genre,
  HiddenMusicTrack,
  ImageSearch,
  MusicLibrary,
  MusicTrack,
  Playlist,
  PlaylistSorting,
  PlaylistTrack,
  QueueItem,
  SavedFilter,
  Session,
  Subgenre,
  TrackGenre,
  TrackSubgenre,
  User,
} from './model-types';

export const models = {
  playlist: modelFactory<Playlist, PlaylistId>(modelIdFactory('Playlist')),
  user: modelFactory<User, UserId>(modelIdFactory('User')),
  playlistTrack: modelFactory<PlaylistTrack, PlaylistTrackId>(modelIdFactory('PlaylistTrack')),
  playlistSorting: modelFactory<PlaylistSorting, PlaylistSortingId>(
    modelIdFactory('PlaylistSorting'),
  ),
  musicTrack: modelFactory<MusicTrack, MusicTrackId>(modelIdFactory('MusicTrack')),
  musicLibrary: modelFactory<MusicLibrary, MusicLibraryId>(modelIdFactory('MusicLibrary')),
  savedFilter: modelFactory<SavedFilter, SavedFilterId>(modelIdFactory('SavedFilter')),
  genre: modelFactory<Genre, GenreId>(modelIdFactory('Genre')),
  subgenre: modelFactory<Subgenre, SubgenreId>(modelIdFactory('Subgenre')),
  library: modelFactory<MusicLibrary, MusicLibraryId>(modelIdFactory('MusicLibrary')),
  queueItem: modelFactory<QueueItem, QueueItemId>(modelIdFactory('QueueItem')),
  imageSearch: modelFactory<ImageSearch, ImageSearchId>(modelIdFactory('ImageSearch')),
  cosineTrackMatch: modelFactory<CosineTrackMatch, CosineTrackMatchId>(
    modelIdFactory('CosineTrackMatch'),
  ),
  hiddenMusicTrack: modelFactory<HiddenMusicTrack, HiddenMusicTrackId>(
    modelIdFactory('HiddenMusicTrack'),
  ),
  session: modelFactory<Session, SessionId>(modelIdFactory('Session')),
  trackGenre: modelFactory<TrackGenre, TrackGenreId>(modelIdFactory('TrackGenre')),
  trackSubgenre: modelFactory<TrackSubgenre, TrackSubgenreId>(modelIdFactory('TrackSubgenre')),
  aiServiceSettings: modelFactory<AiServiceSettings, AiServiceSettingsId>(
    modelIdFactory('AiServiceSettings'),
  ),
};
