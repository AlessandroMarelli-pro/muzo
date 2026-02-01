import { Maybe } from '../common';
import type {
  Brand,
  ImageSearchId,
  MusicLibraryId,
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
  | PlaylistSorting
  | MusicLibrary;

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
  isFavorite: boolean;
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
  artist: string;
  title: string;
  imagePath: string;
  libraryId: MusicLibraryId;
  stats: MusicTrackStats;
  fileInfo: AudioFileInfo;
  technicalInfo: AudioTechnical;
  features: AudioFileFeatures;
  metadata: AudioFileMetadata;
  aiMetadata: AudioFileAIMetadata;
  analysisInfo: AudioFileAnalysis;
};

export type MusicTrackStats = {
  listeningCount: number;
  lastPlayedAt: Date;
  isFavorite: boolean;
  isLiked: boolean;
  isBanger: boolean;
};

export type AudioFileInfo = {
  filePath: string;
  fileName: string;
  fileSize: number;
  fileCreatedAt: Date;
};

export type AudioTechnical = {
  duration: number;
  format: string;
  bitrate: number;
  sampleRate: number;
};

export type AudioFileMetadata = {
  album: string;
  duration: number;
  date: Date;
  genres: string[];
  subgenres: string[];
};

export type AudioFileFeatures = {
  musicalFeatures: AudioFileMusicalFeatures;
};

export type AudioFileMusicalFeatures = {
  tempo: number;
  key: string;
  camelotKey: string;
  energy: number;
  valence: number;
  valenceMood: string;
  danceability: number;
  danceabilityFeeling: string;
  arousal: number;
  arousalMood: string;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
  liveness: number;
  energyComment: string;
  energyKeywords: string[];
};

export type AudioFileAIMetadata = {
  description: string;
  tags: string[];
  vocalsDesc: string;
  atmosphereDesc: string[];
  contextBackground: string;
  contextImpact: string;
};
export const audioFileAnalysisStatusKeys = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
] as const;

export type AudioFileAnalysisStatus =
  (typeof audioFileAnalysisStatusKeys)[number];

export type AudioFileAnalysis = {
  status: AudioFileAnalysisStatus;
  startedAt: Date;
  completedAt: Date;
  error: Maybe<string>;
};

export type MusicLibrary = Readonly<ModelBase<MusicLibraryId>> & {};

export type ImageSearch = Readonly<ModelBase<ImageSearchId>> & {
  trackId: MusicTrackId;
  searchUrl: string;
  imagePath: string;
  imageUrl: string;
  error: Maybe<string>;
};
